import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Hinata Claim NFT', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let hinata: Contract;
  let storage: Contract;
  const recipient = '0x4d0646D2A4E939F698aE97cf01D75D1a99181616';

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    const HinataFactory = await ethers.getContractFactory('Hinata');
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');

    const weth = await MockERC20Factory.deploy('Mock WETH', 'WETH', 0);
    hinata = await HinataFactory.deploy('0xe26C1b781dC472D5Ff17FA1A542eF609bd0F2b87');
    storage = await upgrades.deployProxy(
      HinataStorageFactory,
      [[owner.address], hinata.address, weth.address],
      { initializer: 'initialize(address[],address,address)', kind: 'uups' },
    );
    await hinata.setStorage(storage.address);
  });

  it("revert to mint free nft without being Hinata's verifier", async () => {
    await expect(
      hinata
        .connect(alice)
        .claimNFT(
          recipient,
          987654,
          1,
          7,
          '0x960c5228de19dfa4f7765a6644e12de8c004fe19bf515955ef83c32d320de59226c1f09bc148a7bbbdc8cb488f304fef6f48593c6c78a13dac5f136db3a542551c',
          [],
        ),
    ).to.revertedWith('Invalid signature');
  });

  it("should mint free nft with Hinata's verifier signature", async () => {
    const tx = await hinata.claimNFT(
      recipient,
      987654,
      1,
      7,
      '0x24e70e1f79a8fb9c288010213840cd8d1de213ddd951edbf17faadc3938f246407b44257e173403e64f4df5490d7b0f4661ca1876bdf77d87643ea5fc1daad031b',
      [],
    );
    expect(tx).to.emit(hinata, 'ClaimNFT').withArgs(recipient, 987654, 1);
  });
});
