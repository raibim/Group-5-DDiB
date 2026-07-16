// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LicensingRoyalty
/// @notice One instance is deployed per accepted license agreement between a company and a
/// student's project. The company funds the agreed price; on release the balance is split
/// automatically 10% student / 5% university / 85% company (bps configurable at deploy
/// time). Embodies the concept doc's "Licensing Contract" (lock payment, transfer license)
/// and "Royalty Contract" (10% Student / 5% University / 85% Company) in a single escrow.
contract LicensingRoyalty {
    uint16 private constant BPS_DENOMINATOR = 10000;

    address public immutable studentAddress;
    address public immutable universityAddress;
    address public immutable companyAddress;
    uint16 public immutable studentBps;
    uint16 public immutable universityBps;
    uint16 public immutable companyBps;
    uint256 public immutable priceWei;

    bool public funded;
    bool public released;

    event Funded(address indexed from, uint256 amount);
    event Released(uint256 studentAmount, uint256 universityAmount, uint256 companyAmount);

    constructor(
        address _studentAddress,
        address _universityAddress,
        address _companyAddress,
        uint16 _studentBps,
        uint16 _universityBps,
        uint256 _priceWei
    ) {
        require(
            _studentAddress != address(0) &&
                _universityAddress != address(0) &&
                _companyAddress != address(0),
            "InnovChain: zero address"
        );
        require(_studentBps + _universityBps <= BPS_DENOMINATOR, "InnovChain: bps overflow");
        require(_priceWei > 0, "InnovChain: price must be > 0");

        studentAddress = _studentAddress;
        universityAddress = _universityAddress;
        companyAddress = _companyAddress;
        studentBps = _studentBps;
        universityBps = _universityBps;
        companyBps = BPS_DENOMINATOR - _studentBps - _universityBps;
        priceWei = _priceWei;
    }

    /// @notice The licensee company pays the agreed price, locking it in the contract.
    function fund() external payable {
        require(!funded, "InnovChain: already funded");
        require(msg.sender == companyAddress, "InnovChain: only licensee company may fund");
        require(msg.value == priceWei, "InnovChain: incorrect amount");
        funded = true;
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Splits and pays out the held balance to student/university/company. Callable
    /// once, by either party to the agreement, once funded.
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
        uint256 companyAmount = balance - studentAmount - universityAmount;

        emit Released(studentAmount, universityAmount, companyAmount);

        (bool sentStudent, ) = studentAddress.call{value: studentAmount}("");
        require(sentStudent, "InnovChain: student transfer failed");
        (bool sentUniversity, ) = universityAddress.call{value: universityAmount}("");
        require(sentUniversity, "InnovChain: university transfer failed");
        (bool sentCompany, ) = companyAddress.call{value: companyAmount}("");
        require(sentCompany, "InnovChain: company transfer failed");
    }
}
