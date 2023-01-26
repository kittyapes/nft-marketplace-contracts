import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, BigNumber, Wallet, constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

enum ListingType {
  FIXED_PRICE,
  INVENTORIED_FIXED_PRICE,
  TIME_LIMITED_WINNER_TAKE_ALL_AUCTION,
  TIERED_1_OF_N_AUCTION,
  TIME_LIMITED_PRICE_PER_TICKET_RAFFLE,
  TIME_LIMITED_1_OF_N_WINNING_TICKETS_RAFFLE,
}

describe.only('HinataMarketV2', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let payToken: Contract;
  let storage: Contract;
  let factory: Contract;
  let market: Contract;
  const hinata = '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015';
  const price = utils.parseEther('100');

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
    const CollectionHelperFactory = await ethers.getContractFactory('CollectionHelper');
    const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
    const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');

    const weth = await MockERC20Factory.deploy('Mock WETH', 'WETH', 0);
    payToken = await MockERC20Factory.deploy('MockToken', 'MCK', 0);
    storage = await upgrades.deployProxy(
      HinataStorageFactory,
      [[owner.address], hinata, weth.address],
      { initializer: 'initialize(address[],address,address)', kind: 'uups' },
    );
    const helper = await CollectionHelperFactory.deploy('');
    factory = await upgrades.deployProxy(
      CollectionFactory,
      [helper.address, storage.address, 9850],
      { initializer: 'initialize', kind: 'uups' },
    );
    market = await upgrades.deployProxy(
      HinataMarketV2Factory,
      [[owner.address], factory.address, owner.address, 1000],
      { initializer: 'initialize', kind: 'uups' },
    );

    await market.setLimitCount(10);
    await market.setAcceptPayToken(payToken.address, true);
    await storage.addArtist(alice.address);
    await storage.connect(alice).mintBatchArtistNFT([1, 2], [10, 10], '0x');
    await storage.connect(alice).setApprovalForAll(market.address, true);

    await payToken.setBalance(bob.address, price);
    await payToken.connect(bob).approve(market.address, price);
  });

  describe('#initialize', () => {
    it('revert if factory is 0x0', async () => {
      const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
      await expect(
        upgrades.deployProxy(
          HinataMarketV2Factory,
          [[owner.address], constants.AddressZero, owner.address, 1000],
          { initializer: 'initialize', kind: 'uups' },
        ),
      ).to.revertedWith('MarketV2: INVALID_FACTORY');
    });

    it('revert if fee is over max', async () => {
      const HinataMarketV2Factory = await ethers.getContractFactory('HinataMarketV2');
      await expect(
        upgrades.deployProxy(
          HinataMarketV2Factory,
          [[owner.address], factory.address, owner.address, 10001],
          { initializer: 'initialize', kind: 'uups' },
        ),
      ).to.revertedWith('MarketV2: INVALID_FEE');
    });

    it('check initial values', async () => {
      expect(await market.factory()).to.equal(factory.address);
      expect(await market.marketFee()).to.equal(1000);
    });
  });

  describe('#setAcceptPayToken', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(
        market.connect(alice).setAcceptPayToken(payToken.address, false),
      ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('revert if pay token is 0x0', async () => {
      await expect(market.setAcceptPayToken(constants.AddressZero, false)).to.revertedWith(
        'MarketV2: INVALID_PAY_TOKEN',
      );
    });

    it('should accept new pay token', async () => {
      await market.setAcceptPayToken(payToken.address, false);
      expect(await market.acceptPayTokens(payToken.address)).to.equal(false);
    });
  });

  describe('#setMarketFee', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(market.connect(alice).setMarketFee(10)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if fee is over max', async () => {
      await expect(market.setMarketFee(10001)).to.revertedWith('MarketV2: INVALID_FEE');
    });

    it('should set new fee', async () => {
      await market.setMarketFee(100);
      expect(await market.marketFee()).to.equal(100);
    });
  });

  describe('#purchaseListing', () => {
    it('revert if invalid signature', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        alice,
        payToken,
        price,
        price,
        BigNumber.from(currentTime),
        BigNumber.from('0'),
        BigNumber.from(currentTime).add(10000),
        BigNumber.from('0'),
        ListingType.FIXED_PRICE,
        [storage.address],
        [BigNumber.from('1')],
        [BigNumber.from('10')],
        BigNumber.from('0'),
      );

      const listing = [
        alice.address,
        payToken.address,
        price,
        price,
        currentTime,
        0,
        currentTime + 10000,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await expect(market.connect(bob).purchaseListing(listing, 1, signature)).to.revertedWith(
        'MarketV2: INVALID_SIGNATURE',
      );
    });

    it('should purchase listing', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        alice,
        payToken,
        price,
        price,
        BigNumber.from(currentTime),
        BigNumber.from('0'),
        BigNumber.from(currentTime).add(10000),
        BigNumber.from('0'),
        ListingType.FIXED_PRICE,
        [storage.address],
        [BigNumber.from('1')],
        [BigNumber.from('10')],
        BigNumber.from('0'),
      );

      const listing = [
        alice.address,
        payToken.address,
        price,
        price,
        currentTime,
        0,
        currentTime + 10000,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await market.connect(bob).purchaseListing(listing, 0, signature);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(10);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee);
    });
  });

  describe('#completeAuction', () => {
    it('revert if invalid signature', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        alice,
        payToken,
        price,
        price,
        BigNumber.from(currentTime),
        BigNumber.from('0'),
        BigNumber.from(currentTime).add(10000),
        BigNumber.from('0'),
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [BigNumber.from('1')],
        [BigNumber.from('10')],
        BigNumber.from('0'),
      );
      const bidSignature = await getBidSignature(bob, price, BigNumber.from('0'));

      const listing = [
        alice.address,
        payToken.address,
        price,
        price,
        currentTime,
        0,
        currentTime + 10000,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
      ];
      const bidding = [bob.address, price];

      await expect(
        market.connect(alice).completeAuction(listing, bidding, 1, 0, signature, bidSignature),
      ).to.revertedWith('MarketV2: INVALID_SIGNATURE');
      await expect(
        market.connect(alice).completeAuction(listing, bidding, 0, 1, signature, bidSignature),
      ).to.revertedWith('MarketV2: INVALID_SIGNATURE_FOR_BID');
    });

    it('should complete auction', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        alice,
        payToken,
        price,
        price,
        BigNumber.from(currentTime),
        BigNumber.from('0'),
        BigNumber.from(currentTime).add(10000),
        BigNumber.from('0'),
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [BigNumber.from('1')],
        [BigNumber.from('10')],
        BigNumber.from('0'),
      );
      const bidSignature = await getBidSignature(bob, price, BigNumber.from('0'));

      const listing = [
        alice.address,
        payToken.address,
        price,
        price,
        currentTime,
        0,
        currentTime + 10000,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
      ];
      const bidding = [bob.address, price];

      await market.connect(alice).completeAuction(listing, bidding, 0, 0, signature, bidSignature);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(10);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee);
    });
  });
});

const getListingSignature = async (
  seller: SignerWithAddress,
  payToken: Contract,
  price: BigNumber,
  reservePrice: BigNumber,
  startTime: BigNumber,
  duration: BigNumber,
  endTime: BigNumber,
  quantity: BigNumber,
  listingType: ListingType,
  collections: Array<string>,
  tokenIds: Array<BigNumber>,
  tokenAmounts: Array<BigNumber>,
  nonce: BigNumber,
) => {
  let message = ethers.utils.solidityKeccak256(
    [
      'address',
      'address',
      'uint128',
      'uint128',
      'uint64',
      'uint64',
      'uint64',
      'uint64',
      'uint8',
      'address[]',
      'uint256[]',
      'uint256[]',
      'uint256',
    ],
    [
      seller.address,
      payToken.address,
      price,
      reservePrice,
      startTime,
      duration,
      endTime,
      quantity,
      listingType,
      collections,
      tokenIds,
      tokenAmounts,
      nonce,
    ],
  );
  return await seller.signMessage(ethers.utils.arrayify(message));
};

const getBidSignature = async (
  bidder: SignerWithAddress,
  bidAmount: BigNumber,
  nonce: BigNumber,
) => {
  let message = ethers.utils.solidityKeccak256(
    ['address', 'uint256', 'uint256'],
    [bidder.address, bidAmount, nonce],
  );
  return await bidder.signMessage(ethers.utils.arrayify(message));
};
