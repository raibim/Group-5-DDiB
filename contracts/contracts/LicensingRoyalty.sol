// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LicensingRoyalty
/// @notice One instance is deployed per accepted license agreement (a "sale") between a
/// company and a student's project. The licensee company pays the FULL agreed sale price
/// into escrow via `fund()`; `release()` then splits that entire amount three ways between
/// the student, the university, and the platform, in fixed proportions (default 85% / 5% /
/// 10%). Unlike an earlier revenue-share design of this contract, the company is purely a
/// payer here - it never receives a payout, since the whole point of a sale is that the
/// buyer's payment moves to the sellers, not partially back to itself.
contract LicensingRoyalty {
    uint16 private constant BPS_DENOMINATOR = 10000;

    address public immutable studentAddress;
    address public immutable universityAddress;
    address public immutable companyAddress; // licensee/buyer; access control only, never paid
    address public immutable platformAddress; // InnovChain's own cut
    uint16 public immutable studentBps;
    uint16 public immutable universityBps;
    uint16 public immutable platformBps;
    uint256 public immutable priceWei; // full sale price; escrowed and paid out in full

    bool public funded;
    bool public released;

    event Funded(address indexed from, uint256 amount);
    event Released(uint256 studentAmount, uint256 universityAmount, uint256 platformAmount);

    constructor(
        address _studentAddress,
        address _universityAddress,
        address _companyAddress,
        address _platformAddress,
        uint16 _studentBps,
        uint16 _universityBps,
        uint16 _platformBps,
        uint256 _priceWei
    ) {
        require(
            _studentAddress != address(0) &&
                _universityAddress != address(0) &&
                _companyAddress != address(0) &&
                _platformAddress != address(0),
            "InnovChain: zero address"
        );
        require(
            uint256(_studentBps) + uint256(_universityBps) + uint256(_platformBps) ==
                BPS_DENOMINATOR,
            "InnovChain: bps must sum to 100%"
        );
        require(_priceWei > 0, "InnovChain: price must be > 0");

        studentAddress = _studentAddress;
        universityAddress = _universityAddress;
        companyAddress = _companyAddress;
        platformAddress = _platformAddress;
        studentBps = _studentBps;
        universityBps = _universityBps;
        platformBps = _platformBps;
        priceWei = _priceWei;
    }

    /// @notice The licensee company pays the full agreed sale price, locking it in escrow.
    function fund() external payable {
        require(!funded, "InnovChain: already funded");
        require(msg.sender == companyAddress, "InnovChain: only licensee company may fund");
        require(msg.value == priceWei, "InnovChain: incorrect amount");
        funded = true;
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Splits and pays out the full escrowed sale price to student, university, and
    /// platform, proportional to their bps. Callable once, by either party, once funded.
    function release() external {
        require(funded, "InnovChain: not funded");
        require(!released, "InnovChain: already released");
        require(
            msg.sender == studentAddress || msg.sender == companyAddress,
            "InnovChain: only student or company may trigger release"
        );
        released = true;

        uint256 balance = address(this).balance;
        uint256 studentAmount = (balance * studentBps) / BPS_DENOMINATOR;
        uint256 universityAmount = (balance * universityBps) / BPS_DENOMINATOR;
        // Remainder (rather than balance * platformBps / DENOM) absorbs integer-division
        // dust so the contract's balance always reaches exactly zero.
        uint256 platformAmount = balance - studentAmount - universityAmount;

        emit Released(studentAmount, universityAmount, platformAmount);

        (bool sentStudent, ) = studentAddress.call{value: studentAmount}("");
        require(sentStudent, "InnovChain: student transfer failed");
        (bool sentUniversity, ) = universityAddress.call{value: universityAmount}("");
        require(sentUniversity, "InnovChain: university transfer failed");
        (bool sentPlatform, ) = platformAddress.call{value: platformAmount}("");
        require(sentPlatform, "InnovChain: platform transfer failed");
    }
}
