import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ecsign } from 'ethereumjs-util';
import { Contract, BigNumber, constants, utils, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = utils;

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
  let alice: Wallet;
  let bob: Wallet;
  let payToken: Contract;
  let storage: Contract;
  let factory: Contract;
  let market: Contract;
  const hinata = '0x35CaaBA865BD019dc738eCB96Ec7D0a7Ab349015';
  const price = utils.parseEther('100');

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    alice = Wallet.fromMnemonic(
      'test test test test test test test test test test test junk',
      "m/44'/60'/0'/0",
    ).connect(owner.provider);
    bob = Wallet.fromMnemonic(
      'test test test test test test test test test test test junk',
      "m/44'/60'/0",
    ).connect(owner.provider);
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
        1,
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
        1,
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
        1,
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
        1,
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
  market: Contract,
  seller: Wallet,
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
  const separator = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(
          toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
          ),
        ),
        keccak256(toUtf8Bytes('HinataMarketV2')),
        keccak256(toUtf8Bytes('1.0')),
        (await ethers.provider.getNetwork()).chainId,
        market.address,
      ],
    ),
  );
  const message = keccak256(
    toUtf8Bytes(
      'ListingMessage(address seller,address payToken,uint128 price,uint128 reservePrice,uint64 startTime,uint64 duration,uint64 expireTime,uint64 quantity,uint8 listingType,address[] collections,uint256[] tokenIds,uint256[] tokenAmounts,uint256 nonce)',
    ),
  );
  const data = keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        separator,
        keccak256(
          defaultAbiCoder.encode(
            [
              'bytes32',
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
              message,
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
          ),
        ),
      ],
    ),
  );
  const { v, r, s } = ecsign(
    Buffer.from(data.slice(2), 'hex'),
    Buffer.from(seller.privateKey.slice(2), 'hex'),
  );
  return utils.joinSignature({ v, r: '0x' + r.toString('hex'), s: '0x' + s.toString('hex') });
};

const getBidSignature = async (
  market: Contract,
  seller: Wallet,
  listingNonce: BigNumber,
  bidder: Wallet,
  bidAmount: BigNumber,
  nonce: BigNumber,
) => {
  const separator = keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(
          toUtf8Bytes(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
          ),
        ),
        keccak256(toUtf8Bytes('HinataMarketV2')),
        keccak256(toUtf8Bytes('1.0')),
        (await ethers.provider.getNetwork()).chainId,
        market.address,
      ],
    ),
  );
  const message = keccak256(
    toUtf8Bytes(
      'BidMessage(address seller,uint256 listingNonce,address bidder,uint256 amount,uint256 nonce)',
    ),
  );
  const data = keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        separator,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'uint256', 'address', 'uint256', 'uint256'],
            [message, seller.address, listingNonce, bidder.address, bidAmount, nonce],
          ),
        ),
      ],
    ),
  );
  const { v, r, s } = ecsign(
    Buffer.from(data.slice(2), 'hex'),
    Buffer.from(bidder.privateKey.slice(2), 'hex'),
  );
  return utils.joinSignature({ v, r: '0x' + r.toString('hex'), s: '0x' + s.toString('hex') });
};
