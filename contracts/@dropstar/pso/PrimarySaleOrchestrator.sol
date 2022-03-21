// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract PrimarySaleOrchestrator is Ownable, EIP712 {
    using ECDSA for bytes32;
    using SafeMath for uint256;

    mapping(bytes32 => bool) public hashUsed;

    address[] public signers;

    constructor() EIP712("PrimarySaleOrchestrator", "1.0.0") {}

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function signersAll() external view returns (address[] memory) {
        return signers;
    }

    function fulfillBid(
        address _tokenAddress,
        uint256 _tokenId,
        address _holder,
        uint256 _price,
        address _bidWinner,
        address payable _paymentRecipient,
        uint256 _startDate,
        uint256 _deadline,
        Signature[] calldata _signatures
    ) external payable {
        require(ERC1155(_tokenAddress).isApprovedForAll(_holder, address(this)), "ERR1");

        require(msg.value >= _price, "ERR2");

        uint256[] memory tokenIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);

        tokenIds[0] = _tokenId;
        amounts[0] = 1;

        require(_bidWinner == msg.sender, "ERR3");

        require(_startDate < _deadline, "ERRDATEINVALID");

        require(_startDate < block.timestamp, "ERRDATESOON");

        require(_deadline > block.timestamp, "ERRDATELATE");

        require(_paymentRecipient != address(0));
        require(_bidWinner != address(0));

        (bool sent, bytes memory data) = _paymentRecipient.call{value: msg.value}("");
        require(sent, "ERR4");

        require(
            recoverAll(
                doHash(_tokenAddress, _tokenId, _holder, _price, _bidWinner, _paymentRecipient, _startDate, _deadline),
                _signatures
            ),
            "ERR05"
        );

        ERC1155(_tokenAddress).safeBatchTransferFrom(_holder, _bidWinner, tokenIds, amounts, "0x00");
    }

    function setSigners(address[] calldata _signers) external onlyOwner {
        signers = _signers;
    }

    function doHash(
        address _tokenAddress,
        uint256 _tokenId,
        address _holderAddress,
        uint256 _price,
        address _bidWinner,
        address _paymentRecipient,
        uint256 _startDate,
        uint256 _deadline
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _tokenAddress,
                    _tokenId,
                    _holderAddress,
                    _price,
                    _bidWinner,
                    _paymentRecipient,
                    _startDate,
                    _deadline
                )
            );
    }

    function recover(
        bytes32 _message,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external pure returns (address) {
        bytes32 ethHash = _message.toEthSignedMessageHash();
        return ethHash.recover(v, r, s);
    }

    function recoverAll(bytes32 _message, Signature[] calldata _signatures) internal view returns (bool) {
        bytes32 ethHash = _message.toEthSignedMessageHash();

        bool isValid = true;

        require(_signatures.length == signers.length, "ERRSIGNERS");

        for (uint256 i = 0; i < _signatures.length; i++) {
            if (ethHash.recover(_signatures[i].v, _signatures[i].r, _signatures[i].s) != signers[i]) isValid = false;
        }
        return isValid;
    }

    /*
    Which function is called, fallback() or receive()?

           send Ether
               |
         msg.data is empty?
              / \
            yes  no
            /     \
receive() exists?  fallback()
         /   \
        yes   no
        /      \
    receive()   fallback()
    */

    // Function to receive Ether. msg.data must be empty
    receive() external payable {
        revert("ERR01");
    }

    // Fallback function is called when msg.data is not empty
    fallback() external payable {
        revert("ERR01");
    }
}
