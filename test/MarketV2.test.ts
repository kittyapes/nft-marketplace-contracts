import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, BigNumber, constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

enum ListingType {
  FIXED_PRICE,
  INVENTORIED_FIXED_PRICE,
  TIME_LIMITED_WINNER_TAKE_ALL_AUCTION,
  TIERED_1_OF_N_AUCTION,
  TIME_LIMITED_PRICE_PER_TICKET_RAFFLE,
  TIME_LIMITED_1_OF_N_WINNING_TICKETS_RAFFLE,
}

describe('HinataMarketV2', function () {
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

    await owner.sendTransaction({ to: alice.address, value: utils.parseEther('5') });
    await owner.sendTransaction({ to: bob.address, value: utils.parseEther('5') });
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
        market,
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
        1,
      ];

      await expect(market.connect(bob).purchaseListing(listing, signature)).to.revertedWith(
        'MarketV2: INVALID_SIGNATURE',
      );
    });

    it('should purchase listing', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        market,
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
        0,
      ];

      await market.connect(bob).purchaseListing(listing, signature);
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
        market,
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
      const bidSignature = await getBidSignature(
        market,
        alice,
        BigNumber.from('0'),
        bob,
        price,
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
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
        1,
      ];
      const bidding = [bob.address, price, 1];

      await expect(
        market.connect(alice).completeAuction(listing, bidding, signature, bidSignature),
      ).to.revertedWith('MarketV2: INVALID_SIGNATURE');
      listing[listing.length - 1] = 0;
      await expect(
        market.connect(alice).completeAuction(listing, bidding, signature, bidSignature),
      ).to.revertedWith('MarketV2: INVALID_SIGNATURE_FOR_BID');
    });

    it('should complete auction', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const signature = await getListingSignature(
        market,
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
      const bidSignature = await getBidSignature(
        market,
        alice,
        BigNumber.from('0'),
        bob,
        price,
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
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
        0,
      ];
      const bidding = [bob.address, price, 0];

      await market.connect(alice).completeAuction(listing, bidding, signature, bidSignature);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(10);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee);
    });
  });
});

const getListingSignature = async (
  market: Contract,
  seller: SignerWithAddress,
  payToken: Contract,
  price: BigNumber,
  reservePrice: BigNumber,
  startTime: BigNumber,
  duration: BigNumber,
  expireTime: BigNumber,
  quantity: BigNumber,
  listingType: ListingType,
  collections: Array<string>,
  tokenIds: Array<BigNumber>,
  tokenAmounts: Array<BigNumber>,
  nonce: BigNumber,
) => {
  const { chainId } = await ethers.provider.getNetwork();
  const domain = {
    name: 'HinataMarketV2',
    version: '1.0',
    chainId,
    verifyingContract: market.address,
  };
  const types = {
    Listing: [
      { name: 'seller', type: 'address' },
      { name: 'payToken', type: 'address' },
      { name: 'price', type: 'uint128' },
      { name: 'reservePrice', type: 'uint128' },
      { name: 'startTime', type: 'uint64' },
      { name: 'duration', type: 'uint64' },
      { name: 'expireTime', type: 'uint64' },
      { name: 'quantity', type: 'uint64' },
      { name: 'listingType', type: 'uint8' },
      { name: 'collections', type: 'address[]' },
      { name: 'tokenIds', type: 'uint256[]' },
      { name: 'tokenAmounts', type: 'uint256[]' },
      { name: 'nonce', type: 'uint256' },
    ],
  };
  const message = {
    seller: seller.address,
    payToken: payToken.address,
    price,
    reservePrice,
    startTime,
    duration,
    expireTime,
    quantity,
    listingType,
    collections,
    tokenIds,
    tokenAmounts,
    nonce,
  };

  return await seller._signTypedData(domain, types, message);
};

const getBidSignature = async (
  market: Contract,
  seller: SignerWithAddress,
  listingNonce: BigNumber,
  bidder: SignerWithAddress,
  amount: BigNumber,
  nonce: BigNumber,
) => {
  const { chainId } = await ethers.provider.getNetwork();
  const domain = {
    name: 'HinataMarketV2',
    version: '1.0',
    chainId,
    verifyingContract: market.address,
  };
  const types = {
    Bidding: [
      { name: 'seller', type: 'address' },
      { name: 'listingNonce', type: 'uint256' },
      { name: 'bidder', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
  };
  const message = {
    seller: seller.address,
    listingNonce: listingNonce,
    bidder: bidder.address,
    amount,
    nonce,
  };

  return await bidder._signTypedData(domain, types, message);
};
