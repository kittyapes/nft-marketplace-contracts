import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, Contract, constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { time } from '@openzeppelin/test-helpers';

enum ListingType {
  FIXED_PRICE,
  INVENTORIED_FIXED_PRICE,
  TIME_LIMITED_WINNER_TAKE_ALL_AUCTION,
  TIERED_1_OF_N_AUCTION,
  TIME_LIMITED_PRICE_PER_TICKET_RAFFLE,
  TIME_LIMITED_1_OF_N_WINNING_TICKETS_RAFFLE,
}

describe('Hinata Marketplace', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let payToken: Contract;
  let storage: Contract;
  let factory: Contract;
  let market: Contract;
  const hinata = '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015';
  const price = utils.parseEther('100');

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    const HinataStorageFactory = await ethers.getContractFactory('HinataStorage');
    const CollectionHelperFactory = await ethers.getContractFactory('CollectionHelper');
    const CollectionFactory = await ethers.getContractFactory('CollectionFactory');
    const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');

    const weth = await MockERC20Factory.deploy('Mock WETH', 'WETH', 0);
    payToken = await MockERC20Factory.deploy('MockToken', 'MCK', 0);
    storage = await upgrades.deployProxy(
      HinataStorageFactory,
      [[owner.address], hinata, weth.address],
      {
        initializer: 'initialize(address[],address,address)',
        kind: 'uups',
      },
    );
    const helper = await CollectionHelperFactory.deploy();
    factory = await upgrades.deployProxy(
      CollectionFactory,
      [helper.address, storage.address, 9850],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );
    market = await upgrades.deployProxy(
      HinataMarketplaceFactory,
      [[owner.address], factory.address, owner.address, 1000],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    await market.setAcceptPayToken(payToken.address, true);
    await storage.addArtist(alice.address);
    await storage.connect(alice).mintBatchArtistNFT([1, 2], [10, 10], '0x');
    await storage.connect(alice).setApprovalForAll(market.address, true);

    await payToken.setBalance(bob.address, price);
    await payToken.connect(bob).approve(market.address, price);
  });

  describe('#initialize', () => {
    it('revert if factory is 0x0', async () => {
      const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');
      await expect(
        upgrades.deployProxy(
          HinataMarketplaceFactory,
          [[owner.address], constants.AddressZero, owner.address, 1000],
          {
            initializer: 'initialize',
            kind: 'uups',
          },
        ),
      ).to.revertedWith('HinataMarket: INVALID_FACTORY');
    });

    it('revert if fee is over max', async () => {
      const HinataMarketplaceFactory = await ethers.getContractFactory('HinataMarketplace');
      await expect(
        upgrades.deployProxy(
          HinataMarketplaceFactory,
          [[owner.address], factory.address, owner.address, 10001],
          {
            initializer: 'initialize',
            kind: 'uups',
          },
        ),
      ).to.revertedWith('HinataMarket: INVALID_FEE');
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
        'HinataMarket: INVALID_PAY_TOKEN',
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
      await expect(market.setMarketFee(10001)).to.revertedWith('HinataMarket: INVALID_FEE');
    });

    it('should set new fee', async () => {
      await market.setMarketFee(100);
      expect(await market.marketFee()).to.equal(100);
    });
  });

  describe('#createListing', () => {
    it('revert if pay token is not accepted', async () => {
      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await market.setAcceptPayToken(payToken.address, false);
      await expect(market.connect(alice).createListing(listing)).to.revertedWith(
        'HinataMarket: INVALID_PAY_TOKEN',
      );
    });

    it('revert if invalidated listing', async () => {
      let listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.INVENTORIED_FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await expect(market.connect(alice).createListing(listing)).to.revertedWith(
        'HinataMarket: INVALID_LISTING',
      );

      listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        3,
        ListingType.INVENTORIED_FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await expect(market.connect(alice).createListing(listing)).to.revertedWith(
        'HinataMarket: INVALID_LISTING',
      );
    });

    it('should create listing and revert if use same id again', async () => {
      let listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      let tx = await market.connect(alice).createListing(listing);
      expect(tx).emit(market, 'ListingCreated').withArgs(1, alice.address, ListingType.FIXED_PRICE);

      listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        2,
        ListingType.INVENTORIED_FIXED_PRICE,
        [storage.address],
        [2],
        [10],
      ];

      tx = await market.connect(alice).createListing(listing);
      expect(tx)
        .emit(market, 'ListingCreated')
        .withArgs(2, alice.address, ListingType.INVENTORIED_FIXED_PRICE);

      listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        2,
        ListingType.INVENTORIED_FIXED_PRICE,
        [storage.address],
        [2],
        [10],
      ];
      await expect(market.connect(alice).createListing(listing)).to.revertedWith(
        'HinataMarket: ALREADY_USED_ID',
      );
    });
  });

  describe('#cancelListing', () => {
    beforeEach(async () => {
      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await market.connect(alice).createListing(listing);
    });

    it('revert if caller is not seller', async () => {
      await expect(market.connect(bob).cancelListing(1)).to.revertedWith(
        'HinataMarket: NOT_SELLER',
      );
    });

    it('should cancel and refund nfts', async () => {
      expect(await storage.balanceOf(alice.address, 1)).to.equal(0);
      const tx = await market.connect(alice).cancelListing(1);
      expect(tx).emit(market, 'ListingCancelled').withArgs(1);
      expect(await storage.balanceOf(alice.address, 1)).to.equal(10);
    });

    it('should revert if has bids over reserve price', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      expect(await payToken.balanceOf(bob.address)).to.equal(price);
      await market.connect(bob).bid(2, price);
      expect(await payToken.balanceOf(bob.address)).to.equal(0);
      await expect(market.connect(alice).cancelListing(2)).to.revertedWith(
        'HinataMarket: VALID_BID_EXISTS',
      );
    });

    it('should cancel if has bids under reserve price', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price.add(1),
        0,
        0,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      expect(await payToken.balanceOf(bob.address)).to.equal(price);
      await market.connect(bob).bid(2, price);
      expect(await payToken.balanceOf(bob.address)).to.equal(0);
      await market.connect(alice).cancelListing(2);
      expect(await payToken.balanceOf(bob.address)).to.equal(price);
    });
  });

  describe('#purchaseListing', () => {
    beforeEach(async () => {
      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [1],
        [10],
      ];

      await market.connect(alice).createListing(listing);
    });

    it('revert if buyer is seller', async () => {
      await expect(market.connect(alice).purchaseListing(1)).to.revertedWith(
        'HinataMarket: IS_SELLER',
      );
    });

    it('revert if listing type is auction', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      await expect(market.connect(bob).purchaseListing(2)).to.revertedWith(
        'HinataMarket: NOT_FOR_AUCTION',
      );
    });

    it('should purchase and transfer nfts & funds and check royalty', async () => {
      const tx = await market.connect(bob).purchaseListing(1);
      expect(tx).emit(market, 'ListingPurchased').withArgs(1, alice.address, bob.address);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(10);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee);
    });
  });

  describe('#bid', () => {
    beforeEach(async () => {
      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
      ];

      await market.connect(alice).createListing(listing);
    });

    it('revert if bidder is seller', async () => {
      await expect(market.connect(alice).bid(1, 10)).to.revertedWith('HinataMarket: IS_SELLER');
    });

    it('revert if listing type is not auction', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      await expect(market.connect(bob).bid(2, utils.parseEther('10'))).to.revertedWith(
        'HinataMarket: ONLY_FOR_AUCTION',
      );
    });

    it('revert if inactive auction', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        100,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      await time.increase('1000');
      await expect(market.connect(bob).bid(2, utils.parseEther('10'))).to.revertedWith(
        'HinataMarket: INACTIVE_LISTING',
      );
    });

    it('revert if lower than highest bid or starting price', async () => {
      await expect(market.connect(bob).bid(1, price.div(2))).to.revertedWith(
        'HinataMarket: TOO_LOW_BID',
      );

      const tx = await market.connect(bob).bid(1, price);
      expect(tx).emit(market, 'BidUpdated').withArgs(1, bob.address, price);

      expect(await payToken.balanceOf(bob.address)).to.equal(0);

      await expect(market.connect(bob).bid(1, price)).to.revertedWith(
        'HinataMarket: LOWER_THAN_HIGHEST',
      );
    });
  });

  describe('#completeAuction', () => {
    beforeEach(async () => {
      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.TIERED_1_OF_N_AUCTION,
        [storage.address],
        [1],
        [10],
      ];

      await market.connect(alice).createListing(listing);
    });

    it('revert if the type is not auction', async () => {
      const listing = [
        2,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [storage.address],
        [2],
        [10],
      ];
      await market.connect(alice).createListing(listing);
      await expect(market.connect(alice).completeAuction(2)).to.revertedWith(
        'HinataMarket: ONLY_FOR_AUCTION',
      );
    });

    it('revert if caller is not seller', async () => {
      await expect(market.connect(bob).completeAuction(1)).to.revertedWith(
        'HinataMarket: NOT_SELLER',
      );
    });

    it('revert if no active bid', async () => {
      await expect(market.connect(alice).completeAuction(1)).to.revertedWith(
        'HinataMarket: NO_ACTIVE_BID',
      );
    });

    it('should end auction and transfer nfts & funds', async () => {
      await market.connect(bob).bid(1, price);
      const tx = await market.connect(alice).completeAuction(1);
      expect(tx).emit(market, 'ListingPurchased').withArgs(1, alice.address, bob.address);
      expect(await storage.balanceOf(bob.address, 1)).to.equal(10);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee);
    });
  });

  describe('Royalties', () => {
    it('check royalty to external collections', async () => {
      const tx = await factory.spawn('Test', 'TEST', '', [owner.address], [1000], true);
      const receipt = await tx.wait();
      const nft = receipt.events[0].args.collection;
      const Hinata721Factory = await ethers.getContractFactory('Hinata721');
      const nftContract = await Hinata721Factory.attach(nft);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.mint(alice.address);
      await nftContract.connect(alice).setApprovalForAll(market.address, true);

      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [
          nftContract.address,
          nftContract.address,
          nftContract.address,
          nftContract.address,
          nftContract.address,
        ],
        [1, 2, 3, 4, 5],
        [1, 1, 1, 1, 1],
      ];
      await market.connect(alice).createListing(listing);
      await market.connect(bob).purchaseListing(1);
      expect(await nftContract.balanceOf(bob.address)).to.equal(5);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee.mul(2)));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee.mul(2));
    });

    it('check royalty to external collections for two owners', async () => {
      const Hinata721Factory = await ethers.getContractFactory('Hinata721');
      let tx = await factory.spawn('Test', 'TEST', '', [owner.address], [2000], true);
      let receipt = await tx.wait();
      let nft = receipt.events[0].args.collection;
      const nftContract1 = await Hinata721Factory.attach(nft);
      await nftContract1.mint(alice.address);
      await nftContract1.connect(alice).approve(market.address, 1);

      tx = await factory.connect(carol).spawn('Test', 'TEST', '', [carol.address], [1000], true);
      receipt = await tx.wait();
      nft = receipt.events[0].args.collection;
      const nftContract2 = await Hinata721Factory.attach(nft);
      await nftContract2.connect(carol).mint(alice.address);
      await nftContract2.connect(alice).approve(market.address, 1);

      const listing = [
        1,
        constants.AddressZero,
        payToken.address,
        price,
        price,
        0,
        0,
        0,
        ListingType.FIXED_PRICE,
        [nftContract1.address, nftContract2.address],
        [1, 1],
        [1, 1],
      ];
      await market.connect(alice).createListing(listing);
      await market.connect(bob).purchaseListing(1);
      expect(await nftContract1.balanceOf(bob.address)).to.equal(1);
      expect(await nftContract2.balanceOf(bob.address)).to.equal(1);
      const feePercentage = await market.marketFee();
      const fee = price.mul(feePercentage).div(10000);
      expect(await payToken.balanceOf(alice.address)).to.equal(price.sub(fee.mul(3)));
      expect(await payToken.balanceOf(owner.address)).to.equal(fee.mul(2));
      expect(await payToken.balanceOf(carol.address)).to.equal(fee);
    });
  });
});
