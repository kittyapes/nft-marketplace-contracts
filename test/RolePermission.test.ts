import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const ADMIN_ROLE = '0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e';
const SUPER_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('Hinata Role/Permission Storage', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let storage: Contract;
  const hinata = '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015';

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');

    storage = await upgrades.deployProxy(HinataStorageFactory, [[owner.address], hinata, hinata], {
      initializer: 'initialize(address[],address,address)',
      kind: 'uups',
    });
  });

  it('should add new super admin', async () => {
    const tx = await storage.grantRole(SUPER_ADMIN_ROLE, bob.address);
    expect(tx).emit(storage, 'RoleGranted').withArgs(SUPER_ADMIN_ROLE, bob.address, owner.address);
  });

  it('revert when use admin account grant role super admin', async () => {
    const tx = await storage.grantRole(ADMIN_ROLE, bob.address);
    expect(tx).emit(storage, 'RoleGranted').withArgs(ADMIN_ROLE, bob.address, owner.address);

    await expect(storage.connect(bob).grantRole(SUPER_ADMIN_ROLE, alice.address)).to.revertedWith(
      'AccessControl: account ' +
        bob.address.toLowerCase() +
        ' is missing role 0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('revert add new super admin', async () => {
    await expect(storage.connect(bob).grantRole(ADMIN_ROLE, alice.address)).to.revertedWith(
      'AccessControl: account ' +
        bob.address.toLowerCase() +
        ' is missing role 0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('revert add new admin', async () => {
    await expect(storage.connect(alice).grantRole(ADMIN_ROLE, alice.address)).to.revertedWith(
      'AccessControl: account ' +
        alice.address.toLowerCase() +
        ' is missing role 0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('should add new artist', async () => {
    expect(await storage.addArtist(alice.address)).emit(storage, 'RoleGranted');
  });

  it('revert add new artist', async () => {
    await expect(storage.connect(bob).addArtist(alice.address)).to.revertedWith(
      'AccessControl: account ' +
        bob.address.toLowerCase() +
        ' is missing role 0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('revert add same artist', async () => {
    await storage.addArtist(alice.address);
    const tx = await storage.addArtist(alice.address);
    expect(tx).not.emit(storage, 'RoleGranted');
  });

  it('should remove artist', async () => {
    await storage.addArtist(alice.address);
    const tx = await storage.removeArtist(alice.address);
    expect(tx).emit(storage, 'RoleRevoked');
  });
});
