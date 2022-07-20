// solhint-disable
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract HinataMarketV2 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC1155HolderUpgradeable,
    UUPSUpgradeable
{
    using ECDSAUpgradeable for bytes32;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //Values 0-10,000 map to 0%-100%
    uint256 public marketFee;
    address public treasury;
    address public hinataStorage;

    mapping(address => bool) public acceptPayTokens;
    mapping(bytes => bool) public usedSignatures;

    event Purchased(
        address indexed seller,
        address indexed buyer,
        uint256[] tokenIds,
        uint256[] amounts,
        address payToken,
        uint256 price
    );

    function initialize(
        address hinataStorage_,
        address treasury_,
        uint256 marketFee_
    ) public initializer {
        require(hinataStorage_ != address(0), "MarketV2: INVALID_HINATA_STORAGE");
        require(marketFee_ <= 10000, "MarketV2: INVALID_FEE");

        __ERC1155Holder_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        hinataStorage = hinataStorage_;
        treasury = treasury_;
        marketFee = marketFee_;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setAcceptPayToken(address _payToken, bool _accept) external onlyOwner {
        require(_payToken != address(0), "MarketV2: INVALID_PAY_TOKEN");
        acceptPayTokens[_payToken] = _accept;
    }

    function setMarketFee(uint256 marketFee_) external onlyOwner {
        require(marketFee_ <= 10000, "MarketV2: INVALID_FEE");
        marketFee = marketFee_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function sell(
        address buyer,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address payToken,
        uint256 price,
        bytes memory signature
    ) external nonReentrant {
        require(!usedSignatures[signature], "MarketV2: USED_SIGNATURE");
        require(acceptPayTokens[payToken], "MarketV2: NOT_WHITELISTED_TOKEN");
        require(tokenIds.length == amounts.length, "MarketV2: INVALID_ARGUMENTS");

        address _buyer = buyer;
        address _payToken = payToken;
        uint256 _price = price;
        uint256[] memory _tokenIds = tokenIds;
        uint256[] memory _amounts = amounts;

        bytes32 data = keccak256(
            abi.encodePacked(msg.sender, _buyer, _payToken, _price, _tokenIds, _amounts)
        );
        require(
            data.toEthSignedMessageHash().recover(signature) == _buyer,
            "MarketV2: INVALID_SIGNATURE"
        );
        usedSignatures[signature] = true;

        _acceptPayment(_buyer, _tokenIds, _amounts, _payToken, _price);

        emit Purchased(msg.sender, _buyer, _tokenIds, _amounts, _payToken, _price);
    }

    function _acceptPayment(
        address buyer,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address payToken,
        uint256 price
    ) private {
        IERC1155Upgradeable(hinataStorage).safeBatchTransferFrom(
            msg.sender,
            buyer,
            tokenIds,
            amounts,
            "0x"
        );

        uint256 fee = (price * marketFee) / 10000;
        if (fee > 0) {
            IERC20Upgradeable(payToken).safeTransferFrom(buyer, treasury, fee);
        }
        IERC20Upgradeable(payToken).safeTransferFrom(buyer, msg.sender, price - fee);
    }
}
