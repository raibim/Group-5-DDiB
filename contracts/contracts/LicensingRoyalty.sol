// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LicensingRoyalty
/// @notice One instance is deployed per accepted license agreement between a company and a
/// student's project. Only the student+university royalty share of the agreed license value
/// is escrowed here and released to them — the company's own retained share never moves
/// through this contract, since money the company keeps for itself doesn't need to change
/// hands. `studentBps`/`universityBps` are expressed relative to the *total* license value;
/// `companyBps` (10000 - the other two) is informational only and is never paid out
/// on-chain — it exists so anyone reading the contract can see the full economic picture of
/// the deal, not just the escrowed portion. Embodies the concept doc's "Licensing Contract"
/// (lock payment, transfer license) and "Royalty Contract" (10% Student / 5% University /
/// 85% Company) as a single escrow, without incorrectly routing the company's own money back
/// to itself.
contract LicensingRoyalty {
    uint16 private constant BPS_DENOMINATOR = 10000;

    address public immutable studentAddress;
    address public immutable universityAddress;
    address public immutable companyAddress;
    uint16 public immutable studentBps;
    uint16 public immutable universityBps;
    uint16 public immutable companyBps; // informational only; never transferred by this contract
    uint256 public immutable royaltyWei; // the student+university share to be escrowed and paid out

    bool public funded;
    bool public released;

    event Funded(address indexed from, uint256 amount);
    event Released(uint256 studentAmount, uint256 universityAmount);

    constructor(
        address _studentAddress,
        address _universityAddress,
        address _companyAddress,
        uint16 _studentBps,
        uint16 _universityBps,
        uint256 _royaltyWei
    ) {
        require(
            _studentAddress != address(0) &&
                _universityAddress != address(0) &&
                _companyAddress != address(0),
            "InnovChain: zero address"
        );
        require(_studentBps + _universityBps > 0, "InnovChain: bps must be > 0");
        require(_studentBps + _universityBps <= BPS_DENOMINATOR, "InnovChain: bps overflow");
        require(_royaltyWei > 0, "InnovChain: royalty must be > 0");

        studentAddress = _studentAddress;
        universityAddress = _universityAddress;
        companyAddress = _companyAddress;
        studentBps = _studentBps;
        universityBps = _universityBps;
        companyBps = BPS_DENOMINATOR - _studentBps - _universityBps;
        royaltyWei = _royaltyWei;
    }

    /// @notice The licensee company pays the student+university royalty share, locking it in
    /// the contract. This is deliberately *not* the full license value — the company's own
    /// share never leaves its wallet in the first place.
    function fund() external payable {
        require(!funded, "InnovChain: already funded");
        require(msg.sender == companyAddress, "InnovChain: only licensee company may fund");
        require(msg.value == royaltyWei, "InnovChain: incorrect amount");
        funded = true;
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Splits and pays out the escrowed royalty to the student and university,
    /// proportional to their relative bps. Callable once, by either party, once funded.
    function release() external {
        require(funded, "InnovChain: not funded");
        require(!released, "InnovChain: already released");
        require(
            msg.sender == studentAddress || msg.sender == companyAddress,
            "InnovChain: only student or company may trigger release"
        );
        released = true;

        uint256 balance = address(this).balance;
        uint256 totalBps = uint256(studentBps) + uint256(universityBps);
        uint256 studentAmount = (balance * studentBps) / totalBps;
        uint256 universityAmount = balance - studentAmount;

        emit Released(studentAmount, universityAmount);

        (bool sentStudent, ) = studentAddress.call{value: studentAmount}("");
        require(sentStudent, "InnovChain: student transfer failed");
        (bool sentUniversity, ) = universityAddress.call{value: universityAmount}("");
        require(sentUniversity, "InnovChain: university transfer failed");
    }
}
