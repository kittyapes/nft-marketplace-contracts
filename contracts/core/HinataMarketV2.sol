// solhint-disable
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/ICollectionFactory.sol";

contract HinataMarketV2 is
    Initializable,
    IERC721ReceiverUpgradeable,
    IERC1155ReceiverUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    AccessControl,
    ReentrancyGuardUpgradeable
{
    using ECDSAUpgradeable for bytes32;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 private constant LISTING_MESSAGE =
        keccak256(
            "Listing(address seller,address payToken,uint128 price,uint128 reservePrice,uint64 startTime,uint64 duration,uint64 expireTime,uint64 quantity,uint8 listingType,address[] collections,uint256[] tokenIds,uint256[] tokenAmounts,uint256 nonce)"
        );

    bytes32 private constant BIDDING_MESSAGE =
        keccak256("Bidding(uint256 listingHash,address bidder,uint256 amount,uint256 nonce)");

    bytes32 private constant OFFER_MESSAGE =
        keccak256(
            "Offer(address collection,uint256 tokenId,uint256 tokenAmount,address bidder,address payToken,uint256 amount,uint256 expireTime,uint256 nonce)"
        );

    //Values 0-10,000 map to 0%-100%
    uint256 private constant MAX_DURATION = 120 * 86400;
    uint256 public marketFee;
    address public beneficiary;
    ICollectionFactory public factory;

    uint256 public limitCount;
    mapping(address => bool) public acceptPayTokens;
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    event ListingPurchased(Listing listing, address buyer);
    event OfferAccepted(Offer offer, address seller);

    enum ListingType {
        FIXED_PRICE,
        INVENTORIED_FIXED_PRICE,
        TIME_LIMITED_WINNER_TAKE_ALL_AUCTION,
        TIERED_1_OF_N_AUCTION,
        TIME_LIMITED_PRICE_PER_TICKET_RAFFLE,
        TIME_LIMITED_1_OF_N_WINNING_TICKETS_RAFFLE
    }

    struct Listing {
        address seller;
        address payToken;
        uint128 price;
        uint128 reservePrice;
        uint64 startTime;
        uint64 duration;
        uint64 expireTime;
        uint64 quantity;
        ListingType listingType;
        address[] collections;
        uint256[] tokenIds;
        uint256[] tokenAmounts;
        uint256 nonce;
    }

    struct Bidding {
        address bidder;
        uint256 bidAmount;
        uint256 nonce;
    }

    struct Offer {
        address collection;
        uint256 tokenId;
        uint256 tokenAmount;
        address bidder;
        address payToken;
        uint256 bidAmount;
        uint256 expireTime;
        uint256 nonce;
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Ownable: caller is not the owner");
        _;
    }

    modifier onlyValidListing(Listing memory listing) {
        require(listing.expireTime > block.timestamp, "MarketV2: ALREADY_EXPIRED");
        require(!usedNonces[listing.seller][listing.nonce], "MarketV2: USED_SIGNATURE");
        require(acceptPayTokens[listing.payToken], "MarketV2: NOT_WHITELISTED_TOKEN");
        require(listing.reservePrice >= listing.price, "MarketV2: RESERVE_PRICE_LOW");
        require(listing.collections.length <= limitCount, "MarketV2: MORE_THAN_LIMIT");
        if (listing.listingType == ListingType.INVENTORIED_FIXED_PRICE) {
            require(
                listing.quantity > 0 && _isValidatedListing(listing.tokenAmounts, listing.quantity),
                "MarketV2: INVALID_LISTING"
            );
        }
        _;
    }

    function initialize(
        address[] memory owners,
        address factory_,
        address beneficiary_,
        uint256 marketFee_
    ) public initializer {
        require(factory_ != address(0), "MarketV2: INVALID_FACTORY");
        require(marketFee_ <= 10000, "MarketV2: INVALID_FEE");

        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __EIP712_init("HinataMarketV2", "1.0");

        factory = ICollectionFactory(factory_);
        beneficiary = beneficiary_;
        marketFee = marketFee_;

        uint256 len = owners.length;
        for (uint256 i; i < len; i += 1) {
            _setupRole(DEFAULT_ADMIN_ROLE, owners[i]);
        }
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}

    function purchaseListing(Listing memory listing, bytes memory signature)
        external
        onlyValidListing(listing)
        nonReentrant
    {
        require(listing.seller != msg.sender, "MarketV2: IS_SELLER");

        if (
            listing.listingType == ListingType.TIERED_1_OF_N_AUCTION ||
            listing.listingType == ListingType.TIME_LIMITED_WINNER_TAKE_ALL_AUCTION
        ) {
            revert("MarketV2: NOT_FOR_AUCTION");
        }
        if (listing.listingType == ListingType.TIME_LIMITED_PRICE_PER_TICKET_RAFFLE) {
            require(
                block.timestamp < listing.startTime + listing.duration,
                "MarketV2: STILL_ACTIVE"
            );
        }

        _checkListingSignature(listing, signature);

        _transferNFTs(
            listing.collections,
            listing.tokenIds,
            listing.tokenAmounts,
            listing.seller,
            msg.sender
        );
        _proceedRoyalty(
            listing.seller,
            msg.sender,
            listing.payToken,
            listing.price,
            listing.collections,
            listing.tokenAmounts
        );

        emit ListingPurchased(listing, msg.sender);
    }

    function acceptOffer(Offer memory offer, bytes memory signature) external {
        require(offer.expireTime > block.timestamp, "MarketV2: ALREADY_EXPIRED");
        require(!usedNonces[offer.bidder][offer.nonce], "MarketV2: USED_SIGNATURE");
        require(acceptPayTokens[offer.payToken], "MarketV2: NOT_WHITELISTED_TOKEN");
        require(offer.bidder != msg.sender, "MarketV2: IS_BIDDER");
        require(offer.bidAmount > 0, "MarketV2: ZERO_PRICE");

        bytes32 structHash = keccak256(
            abi.encode(
                OFFER_MESSAGE,
                offer.collection,
                offer.tokenId,
                offer.tokenAmount,
                offer.bidder,
                offer.payToken,
                offer.bidAmount,
                offer.expireTime,
                offer.nonce
            )
        );
        require(
            _hashTypedDataV4(structHash).recover(signature) == offer.bidder,
            "MarketV2: INVALID_SIGNATURE_FOR_OFFER"
        );
        usedNonces[offer.bidder][offer.nonce] = true;

        address[] memory collections = new address[](1);
        collections[0] = offer.collection;
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = offer.tokenId;
        uint256[] memory tokenAmounts = new uint256[](1);
        tokenAmounts[0] = offer.tokenAmount;

        _transferNFTs(collections, tokenIds, tokenAmounts, msg.sender, offer.bidder);
        _proceedRoyalty(
            msg.sender,
            offer.bidder,
            offer.payToken,
            offer.bidAmount,
            collections,
            tokenAmounts
        );

        emit OfferAccepted(offer, msg.sender);
    }

    function completeAuction(
        Listing memory listing,
        Bidding memory bidding,
        bytes memory signature,
        bytes memory signatureForBid
    ) external onlyValidListing(listing) nonReentrant {
        require(listing.seller == msg.sender, "MarketV2: IS_NOT_SELLER");
        require(!usedNonces[bidding.bidder][bidding.nonce], "MarketV2: USED_NONCE_FOR_BID");
        require(bidding.bidder != address(0), "MarketV2: NO_ACTIVE_BID");

        if (
            listing.listingType != ListingType.TIERED_1_OF_N_AUCTION &&
            listing.listingType != ListingType.TIME_LIMITED_WINNER_TAKE_ALL_AUCTION
        ) {
            revert("MarketV2: ONLY_FOR_AUCTION");
        }

        _checkListingSignature(listing, signature);

        bytes32 structHash = keccak256(
            abi.encode(
                BIDDING_MESSAGE,
                keccak256(signature),
                bidding.bidder,
                bidding.bidAmount,
                bidding.nonce
            )
        );
        require(
            _hashTypedDataV4(structHash).recover(signatureForBid) == bidding.bidder,
            "MarketV2: INVALID_SIGNATURE_FOR_BID"
        );
        usedNonces[bidding.bidder][bidding.nonce] = true;

        _transferNFTs(
            listing.collections,
            listing.tokenIds,
            listing.tokenAmounts,
            listing.seller,
            bidding.bidder
        );
        _proceedRoyalty(
            listing.seller,
            bidding.bidder,
            listing.payToken,
            bidding.bidAmount,
            listing.collections,
            listing.tokenAmounts
        );

        emit ListingPurchased(listing, bidding.bidder);
    }

    function useNonce(uint256 nonce) external {
        require(!usedNonces[msg.sender][nonce], "MarketV2: ALREADY_USED");
        usedNonces[msg.sender][nonce] = true;
    }

    function setAcceptPayToken(address _payToken, bool _accept) external onlyAdmin {
        require(_payToken != address(0), "MarketV2: INVALID_PAY_TOKEN");
        acceptPayTokens[_payToken] = _accept;
    }

    function setMarketFee(uint256 marketFee_) external onlyAdmin {
        require(marketFee_ <= 10000, "MarketV2: INVALID_FEE");
        marketFee = marketFee_;
    }

    function setBeneficiary(address beneficiary_) external onlyAdmin {
        require(beneficiary_ != address(0), "MarketV2: INVALID_BENEFICIARY");
        beneficiary = beneficiary_;
    }

    function setLimitCount(uint256 limitCount_) external onlyAdmin {
        limitCount = limitCount_;
    }

    function withdrawFunds(address token, address to) external onlyAdmin {
        IERC20Upgradeable erc20Token = IERC20Upgradeable(token);
        erc20Token.safeTransfer(to, erc20Token.balanceOf(address(this)));
    }

    function queryNonces(address[] calldata accounts, uint256[] calldata nonces)
        external
        view
        returns (bool[] memory res)
    {
        uint256 len = accounts.length;
        res = new bool[](len);
        for (uint256 i; i < len; ++i) {
            res[i] = usedNonces[accounts[i]][nonces[i]];
        }
    }

    function _isValidatedListing(uint256[] memory tokenAmounts, uint64 quantity)
        private
        pure
        returns (bool)
    {
        uint256 len = tokenAmounts.length;
        for (uint256 i; i < len; i += 1) {
            if (tokenAmounts[i] % quantity > 0) {
                return false;
            }
        }
        return true;
    }

    function _checkListingSignature(Listing memory listing, bytes memory signature) private {
        bytes32 structHash = keccak256(
            abi.encode(
                LISTING_MESSAGE,
                listing.seller,
                listing.payToken,
                listing.price,
                listing.reservePrice,
                listing.startTime,
                listing.duration,
                listing.expireTime,
                listing.quantity,
                listing.listingType,
                keccak256(abi.encodePacked(listing.collections)),
                keccak256(abi.encodePacked(listing.tokenIds)),
                keccak256(abi.encodePacked(listing.tokenAmounts)),
                listing.nonce
            )
        );
        require(
            _hashTypedDataV4(structHash).recover(signature) == listing.seller,
            "MarketV2: INVALID_SIGNATURE"
        );
        usedNonces[listing.seller][listing.nonce] = true;
    }

    function _transferNFTs(
        address[] memory collections,
        uint256[] memory tokenIds,
        uint256[] memory tokenAmounts,
        address from,
        address to
    ) internal returns (uint256[] memory tokenAmounts_) {
        require(
            collections.length == tokenIds.length && collections.length == tokenAmounts.length,
            "MarketV2: INVALID_ARGUMENTS"
        );

        tokenAmounts_ = new uint256[](collections.length);
        for (uint256 i; i < tokenIds.length; i += 1) {
            uint8 cType = factory.getType(collections[i]);
            require(cType > 0, "MarketV2: NOT_NFT_CONTRACT");

            if (cType == 1) {
                IERC721Upgradeable(collections[i]).safeTransferFrom(from, to, tokenIds[i]);
                tokenAmounts_[i] = 1;
            } else {
                IERC1155Upgradeable(collections[i]).safeTransferFrom(
                    from,
                    to,
                    tokenIds[i],
                    tokenAmounts[i],
                    ""
                );
                tokenAmounts_[i] = tokenAmounts[i];
            }
        }
    }

    function _proceedRoyalty(
        address seller,
        address buyer,
        address payToken,
        uint256 price,
        address[] memory collections,
        uint256[] memory tokenAmounts
    ) internal {
        uint256 fee = (price * marketFee) / 10000;
        // to seller
        if (fee > 0) {
            IERC20Upgradeable(payToken).safeTransferFrom(buyer, beneficiary, fee);
        }

        // to collection royalty beneficiares
        uint256 royaltyPercentage;
        uint256 sumAmount;
        for (uint256 i; i < collections.length; i += 1) {
            ICollectionFactory.Collection memory collection = factory.getCollection(collections[i]);
            sumAmount += tokenAmounts[i];
            if (royaltyPercentage < collection.royaltySum)
                royaltyPercentage = collection.royaltySum;
        }
        uint256 royalty = (price * royaltyPercentage) / 10000;
        if (price - royalty - fee > 0)
            IERC20Upgradeable(payToken).safeTransferFrom(buyer, seller, price - royalty - fee);
        if (royalty == 0) return;

        for (uint256 i; i < collections.length; i += 1) {
            ICollectionFactory.Collection memory collection = factory.getCollection(collections[i]);
            ICollectionFactory.Royalty[] memory royalties = factory.getCollectionRoyalties(
                collections[i]
            );
            for (uint256 j; j < royalties.length; j += 1)
                IERC20Upgradeable(payToken).safeTransferFrom(
                    buyer,
                    royalties[j].beneficiary,
                    (((royalty * tokenAmounts[i]) / sumAmount) * royalties[j].percentage) /
                        collection.royaltySum
                );
        }
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return
            bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165Upgradeable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
