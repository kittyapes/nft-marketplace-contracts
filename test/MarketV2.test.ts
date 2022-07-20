import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, BigNumber, Wallet, constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HinataMarketV2', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let storage: Contract;
  let market: Contract;
  let token: Contract;
  const treasury = Wallet.createRandom().address;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
    const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

    const weth = await MockERC20Factory.deploy('Mock WETH', 'WETH', 0);
    storage = await upgrades.deployProxy(
      HinataStorageFactory,
      [[owner.address], treasury, weth.address],
      {
        initializer: 'initialize(address[],address,address)',
        kind: 'uups',
      },
    );
    market = await upgrades.deployProxy(HinataMarketV2Factory, [storage.address, treasury, 1000], {
      initializer: 'initialize',
      kind: 'uups',
    });
    token = await MockERC20Factory.deploy('MockToken', 'MCK', 0);
    await market.setAcceptPayToken(token.address, true);
  });

  describe('#initialize', () => {
    it('revert if storage is 0x0', async () => {
      const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
      await expect(
        upgrades.deployProxy(HinataMarketV2Factory, [constants.AddressZero, treasury, 1000], {
          initializer: 'initialize',
          kind: 'uups',
        }),
      ).to.revertedWith('MarketV2: INVALID_HINATA_STORAGE');
    });

    it('revert if fee is over max', async () => {
      const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
      await expect(
        upgrades.deployProxy(HinataMarketV2Factory, [storage.address, treasury, 10001], {
          initializer: 'initialize',
          kind: 'uups',
        }),
      ).to.revertedWith('MarketV2: INVALID_FEE');
    });

    it('check initial values', async () => {
      expect(await market.hinataStorage()).to.equal(storage.address);
      expect(await market.treasury()).to.equal(treasury);
      expect(await market.marketFee()).to.equal(1000);
    });
  });

  describe('#setAcceptPayToken', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(market.connect(alice).setAcceptPayToken(token.address, false)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if pay token is 0x0', async () => {
      await expect(market.setAcceptPayToken(constants.AddressZero, false)).to.revertedWith(
        'MarketV2: INVALID_PAY_TOKEN',
      );
    });

    it('should accept new pay token', async () => {
      await market.setAcceptPayToken(token.address, false);
      expect(await market.acceptPayTokens(token.address)).to.equal(false);
    });
  });

  describe('#setTreasury', () => {
    const newFeeTo = Wallet.createRandom().address;

    it('revert if msg.sender is not owner', async () => {
      await expect(market.connect(alice).setTreasury(newFeeTo)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set market treasury', async () => {
      await market.setTreasury(newFeeTo);
      expect(await market.treasury()).to.equal(newFeeTo);
    });
  });

  describe('#setMarketFee', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(market.connect(alice).setMarketFee(1000)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if fee is over max', async () => {
      await expect(market.setMarketFee(10001)).to.revertedWith('MarketV2: INVALID_FEE');
    });

    it('should set market fee', async () => {
      await market.setMarketFee(2000);
      expect(await market.marketFee()).to.equal(2000);
    });
  });

  describe('#sell', () => {
    beforeEach(async () => {
      await storage.addArtist(alice.address);
      await storage.connect(alice).mintBatchArtistNFT([1, 2], [10, 10], '0x');
      await storage.connect(alice).setApprovalForAll(market.address, true);

      await token.setBalance(bob.address, utils.parseEther('1000'));
      await token.connect(bob).approve(market.address, utils.parseEther('1000'));
    });

    it('revert if invalid signature', async () => {
      const signature = await getSignature(
        market,
        alice,
        bob,
        token,
        utils.parseEther('10'),
        [BigNumber.from('1'), BigNumber.from('2')],
        [BigNumber.from('10'), BigNumber.from('10')],
      );

      await expect(
        market
          .connect(alice)
          .sell(alice.address, [1, 2], [10, 10], token.address, utils.parseEther('10'), signature),
      ).to.revertedWith('MarketV2: INVALID_SIGNATURE');
    });

    it('should sell & revert used signature', async () => {
      const signature = await getSignature(
        market,
        alice,
        bob,
        token,
        utils.parseEther('10'),
        [BigNumber.from('1'), BigNumber.from('2')],
        [BigNumber.from('5'), BigNumber.from('5')],
      );
      await market
        .connect(alice)
        .sell(bob.address, [1, 2], [5, 5], token.address, utils.parseEther('10'), signature);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(5);
      expect(await storage.balanceOf(bob.address, 2)).to.equal(5);

      await expect(
        market
          .connect(alice)
          .sell(bob.address, [1, 2], [5, 5], token.address, utils.parseEther('10'), signature),
      ).to.revertedWith('MarketV2: USED_SIGNATURE');
    });
  });
});

const getSignature = async (
  market: Contract,
  seller: SignerWithAddress,
  buyer: SignerWithAddress,
  payToken: Contract,
  price: BigNumber,
  tokenIds: Array<BigNumber>,
  amounts: Array<BigNumber>,
) => {
  let message = ethers.utils.solidityKeccak256(
    ['address', 'address', 'address', 'uint256', 'uint256[]', 'uint256[]'],
    [seller.address, buyer.address, payToken.address, price, tokenIds, amounts],
  );
  return await buyer.signMessage(ethers.utils.arrayify(message));
};
