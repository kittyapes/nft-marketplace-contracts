import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, Wallet, constants } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Collection Factory', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let storage: Contract;
  let helper: Contract;
  let factory: Contract;
  let nft: Contract;
  let mock: Contract;

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
    const CollectionHelperFactory = await ethers.getContractFactory('CollectionHelper');
    const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
    const Hinata721Factory = await ethers.getContractFactory('Hinata721');
    const MockFactory = await ethers.getContractFactory('Mock');

    mock = await MockFactory.deploy();
    nft = await Hinata721Factory.deploy(owner.address, 'Owner', 'OWNER', '');
    storage = await upgrades.deployProxy(
      HinataStorageFactory,
      [[owner.address], Wallet.createRandom().address, Wallet.createRandom().address],
      { initializer: 'initialize(address[],address,address)', kind: 'uups' },
    );
    helper = await CollectionHelperFactory.deploy('');
    factory = await upgrades.deployProxy(
      CollectionFactory,
      [helper.address, storage.address, 9850],
      { initializer: 'initialize', kind: 'uups' },
    );
  });

  describe('#initialize', () => {
    it('revert if helper is 0x0', async () => {
      const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
      await expect(
        upgrades.deployProxy(CollectionFactory, [constants.AddressZero, storage.address, 9850], {
          initializer: 'initialize',
          kind: 'uups',
        }),
      ).to.revertedWith('CollectionFactory: INVALID_HELPER');
    });

    it('revert if storage is 0x0', async () => {
      const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
      await expect(
        upgrades.deployProxy(CollectionFactory, [helper.address, constants.AddressZero, 9850], {
          initializer: 'initialize',
          kind: 'uups',
        }),
      ).to.revertedWith('CollectionFactory: INVALID_HINATA');
    });

    it('check initial values', async () => {
      expect(await factory.helper()).to.equal(helper.address);
      expect(await factory.hinataStorage()).to.equal(storage.address);
    });
  });

  describe('#create', () => {
    it('should create 721 collection successfully', async () => {
      const tx = await factory.connect(alice).create('Test', 'TEST', [alice.address], [10], true);
      const receipt = await tx.wait();
      const nft = receipt.events[0].args.collection;
      expect(tx)
        .emit(factory, 'CollectionWhitelisted')
        .withArgs(1, alice.address, nft, [alice.address, 10], false);

      const collection = await factory.collections(1);
      expect(collection[0]).to.equal(alice.address);
      expect(collection[1]).to.equal(nft);
      expect(collection[2]).to.equal(10);
      expect(collection[3]).to.equal(true);
    });

    it('should create 1155 collection successfully', async () => {
      const tx = await factory.connect(alice).create('', '', [alice.address], [20], false);
      const receipt = await tx.wait();
      const nft = receipt.events[0].args.collection;
      expect(tx)
        .emit(factory, 'CollectionWhitelisted')
        .withArgs(1, alice.address, nft, [alice.address, 20], false);

      const collection = await factory.collections(1);
      expect(collection[0]).to.equal(alice.address);
      expect(collection[1]).to.equal(nft);
      expect(collection[2]).to.equal(20);
      expect(collection[3]).to.equal(false);
    });
  });

  describe('#register', () => {
    it('revert if collection is not nft', async () => {
      await expect(factory.register(mock.address, owner.address, 100)).to.revertedWith(
        'CollectionFactory: NOT_NFT_COLLECTION',
      );
    });

    it('should register successfully', async () => {
      await factory.register(nft.address, owner.address, 100);

      const collection = await factory.collections(1);
      expect(collection[0]).to.equal(owner.address);
      expect(collection[1]).to.equal(nft.address);
      expect(collection[2]).to.equal(100);
      expect(collection[3]).to.equal(true);
    });
  });
});
