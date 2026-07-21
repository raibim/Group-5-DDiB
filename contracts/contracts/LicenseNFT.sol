// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title LicenseNFT
/// @notice One shared ERC-721 collection. A token is minted to the licensee company once its
/// `LicensingRoyalty` sale contract has been funded and released - holding the token IS
/// holding the license. Each token stores the same student/university/platform royalty split
/// that applied to the original sale, so that if the company later sublicenses (resells) the
/// right via `sublicense()`, the same split is enforced again automatically on the resale
/// price - and again on any resale after that, since the split travels with the token.
///
/// ERC-2981 `royaltyInfo` is implemented for standards compliance with external NFT
/// marketplaces, but ERC-2981 is advisory only: the standard lets a marketplace *ask* what
/// royalty is owed, it does not force anyone to pay it. This contract deliberately does not
/// implement a bare `receive()`/`fallback()`, so a marketplace that reads `royaltyInfo` and
/// then sends a plain, untagged ETH transfer straight to this contract (rather than calling
/// `sublicense()`) will simply have that transaction revert - funds fail loudly instead of
/// getting silently stuck with no way to attribute them to a specific token. `sublicense()` is
/// the only path in this PoC that actually enforces the split: the royalty payout, the
/// transfer to the buyer, and the payment to the seller all happen atomically in one
/// transaction, so a resale cannot complete without the split happening.
contract LicenseNFT is ERC721, ERC2981, Ownable {
    struct RoyaltySplit {
        address studentAddress;
        address universityAddress;
        address platformAddress;
        uint16 studentBps;
        uint16 universityBps;
        uint16 platformBps; // studentBps + universityBps + platformBps <= 10000; remainder to seller
    }

    uint256 private nextTokenId = 1;

    mapping(uint256 => RoyaltySplit) public royaltySplits;
    // Links a token back to the off-chain LicenseRequest it originated from (see docs/API.md).
    mapping(uint256 => uint256) public sourceLicenseRequestId;

    event LicenseMinted(uint256 indexed tokenId, address indexed to, uint256 indexed sourceLicenseRequestId);
    event Sublicensed(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);

    constructor(address initialOwner)
        ERC721("InnovChain License", "ICL")
        Ownable(initialOwner)
    {}

    /// @notice Mints the license NFT to the company once the original sale has been released.
    /// Restricted to the contract owner (InnovChain's operator wallet), since minting is the
    /// backend's confirmation that the corresponding LicensingRoyalty sale actually completed.
    function mint(
        address to,
        uint256 _sourceLicenseRequestId,
        address studentAddress,
        address universityAddress,
        address platformAddress,
        uint16 studentBps,
        uint16 universityBps,
        uint16 platformBps
    ) external onlyOwner returns (uint256 tokenId) {
        require(
            studentAddress != address(0) && universityAddress != address(0) && platformAddress != address(0),
            "InnovChain: zero address"
        );
        require(
            uint256(studentBps) + uint256(universityBps) + uint256(platformBps) <= 10000,
            "InnovChain: bps overflow"
        );

        tokenId = nextTokenId++;
        _safeMint(to, tokenId);

        royaltySplits[tokenId] = RoyaltySplit({
            studentAddress: studentAddress,
            universityAddress: universityAddress,
            platformAddress: platformAddress,
            studentBps: studentBps,
            universityBps: universityBps,
            platformBps: platformBps
        });
        sourceLicenseRequestId[tokenId] = _sourceLicenseRequestId;

        // ERC-2981 basis points share the same 10000 denominator as our bps fields, so the
        // combined split's total fraction can be passed straight through as the fee numerator.
        _setTokenRoyalty(
            tokenId,
            address(this),
            uint96(uint256(studentBps) + uint256(universityBps) + uint256(platformBps))
        );

        emit LicenseMinted(tokenId, to, _sourceLicenseRequestId);
    }

    /// @notice Enforced sublicense (resale): the current holder transfers the license to `to`
    /// for `msg.value`, with this token's royalty split paid out atomically in the same
    /// transaction before the NFT itself moves.
    function sublicense(uint256 tokenId, address to) external payable {
        require(ownerOf(tokenId) == msg.sender, "InnovChain: only current holder may sublicense");
        require(to != address(0), "InnovChain: zero address");
        require(msg.value > 0, "InnovChain: price must be > 0");

        RoyaltySplit memory split = royaltySplits[tokenId];
        uint256 studentAmount = (msg.value * split.studentBps) / 10000;
        uint256 universityAmount = (msg.value * split.universityBps) / 10000;
        uint256 platformAmount = (msg.value * split.platformBps) / 10000;
        uint256 sellerAmount = msg.value - studentAmount - universityAmount - platformAmount;

        address seller = msg.sender;
        _transfer(seller, to, tokenId);

        emit Sublicensed(tokenId, seller, to, msg.value);

        (bool sentStudent, ) = split.studentAddress.call{value: studentAmount}("");
        require(sentStudent, "InnovChain: student transfer failed");
        (bool sentUniversity, ) = split.universityAddress.call{value: universityAmount}("");
        require(sentUniversity, "InnovChain: university transfer failed");
        (bool sentPlatform, ) = split.platformAddress.call{value: platformAmount}("");
        require(sentPlatform, "InnovChain: platform transfer failed");
        (bool sentSeller, ) = seller.call{value: sellerAmount}("");
        require(sentSeller, "InnovChain: seller transfer failed");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
