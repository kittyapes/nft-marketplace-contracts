// solhint-disable
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./HinataMarketplace.sol";

contract BatchQuery {
    struct ListingRes {
        uint256 id;
        address seller;
        address payToken;
        uint128 price;
        uint128 reservePrice;
        uint64 startTime;
        uint64 duration;
        uint64 quantity;
        bool active;
    }

    HinataMarketplace public immutable hinataMarketplace;

    constructor(address _hinataMarketplace) {
        hinataMarketplace = HinataMarketplace(_hinataMarketplace);
    }

    function queryListings(uint256[] calldata listingIds)
        external
        view
        returns (ListingRes[] memory res)
    {
        uint256 len = listingIds.length;
        res = new ListingRes[](len);
        for (uint256 i; i < len; ++i) {
            HinataMarketplace.Listing memory listing = hinataMarketplace.getListingInfo(
                listingIds[i]
            );
            if (listing.seller != address(0)) {
                res[i].id = listing.id;
                res[i].seller = listing.seller;
                res[i].payToken = listing.payToken;
                res[i].price = listing.price;
                res[i].reservePrice = listing.reservePrice;
                res[i].startTime = listing.startTime;
                res[i].duration = listing.duration;
                res[i].active = true;
            }
        }
    }

    // Query invalid listings due to NFT ownership
    function queryNftStatus(uint256[] calldata listingIds)
        external
        view
        returns (bool[] memory res)
    {
        uint256 len = listingIds.length;
        res = new bool[](len);
        for (uint256 i; i < len; ++i) {
            HinataMarketplace.Listing memory listing = hinataMarketplace.getListingInfo(
                listingIds[i]
            );
            uint256 collectionLen = listing.collections.length;
            for (uint256 j; j < collectionLen; ++j) {
                address collection = listing.collections[j];
                uint8 cType = ICollectionFactory(hinataMarketplace.factory()).getType(collection);
                if (cType == 1) {
                    if (
                        IERC721Upgradeable(collection).ownerOf(listing.tokenIds[j]) !=
                        address(hinataMarketplace)
                    ) {
                        res[i] = true;
                        break;
                    }
                } else {
                    if (
                        IERC1155Upgradeable(collection).balanceOf(
                            address(hinataMarketplace),
                            listing.tokenIds[j]
                        ) < listing.tokenAmounts[j]
                    ) {
                        res[i] = true;
                        break;
                    }
                }
            }
        }
    }
}
