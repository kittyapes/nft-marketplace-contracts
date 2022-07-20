// solhint-disable
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IHinataStorage.sol";

/**
    Core functions of ERC20 Hinata
    - Capped
    - Burnable
    - Ownable
    - Set a verifier - normally Hinata backend for signing free NFT
    - Allow user to claimFree NFT that signed by verififers
 */

contract Hinata is ERC20Capped, ERC20Burnable, Ownable {
    event AddedVerifierList(address _verifier);
    event RemovedVerifierList(address _verifier);
    event ClaimNFT(address recipient, uint256 id, uint256 amount);

    mapping(address => bool) public isVerifier;
    mapping(uint256 => bool) public usedNonce;

    IHinataStorage public hinataStorage;

    constructor(address _verifier) ERC20("Hinata", "Hi") ERC20Capped(100000000 * 10**18) {
        isVerifier[_verifier] = true;
    }

    function _mint(address account, uint256 amount) internal override(ERC20Capped, ERC20) {
        require(ERC20.totalSupply() + amount <= cap(), "ERC20Capped: cap exceeded");
        super._mint(account, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function setStorage(IHinataStorage _hinataStorage) external onlyOwner {
        hinataStorage = _hinataStorage;
    }

    function addVerifier(address _verifier) external onlyOwner {
        isVerifier[_verifier] = true;
        emit AddedVerifierList(_verifier);
    }

    function removeVerifier(address _verifier) external onlyOwner {
        delete isVerifier[_verifier];
        emit RemovedVerifierList(_verifier);
    }

    function claimNFT(
        address recipient,
        uint256 id,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature,
        bytes calldata data
    ) external {
        bytes32 message = keccak256(abi.encodePacked(recipient, id, amount, nonce));
        bytes32 hash = ECDSA.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(hash, signature);

        require(isVerifier[signer], "Invalid signature");
        require(!usedNonce[nonce], "Used nonce");
        usedNonce[nonce] = true;

        hinataStorage.mintAirdropNFT(recipient, id, amount, data);
        emit ClaimNFT(recipient, id, amount);
    }
}
