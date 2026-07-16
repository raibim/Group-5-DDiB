// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OwnershipRegistry
/// @notice On-chain proof-of-ownership for student projects. Only the SHA-256 hash of the
/// project file is stored on-chain (not the file itself), together with the owner's
/// address and a block timestamp, so origination can be proven without trusting a
/// centralized database. Embodies the concept doc's "Ownership Contract".
contract OwnershipRegistry {
    struct Project {
        address owner;
        bytes32 fileHash;
        uint256 timestamp;
    }

    uint256 public nextProjectId = 1;
    mapping(uint256 => Project) public projects;
    mapping(bytes32 => uint256) public projectIdByHash;

    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed owner,
        bytes32 fileHash,
        uint256 timestamp
    );

    /// @notice Registers a new project by its content hash. Reverts if the exact same
    /// hash was already registered, which also serves as basic duplicate detection.
    function registerProject(bytes32 fileHash) external returns (uint256 projectId) {
        require(fileHash != bytes32(0), "InnovChain: empty hash");
        require(projectIdByHash[fileHash] == 0, "InnovChain: duplicate project hash");

        projectId = nextProjectId;
        nextProjectId += 1;

        projects[projectId] = Project({
            owner: msg.sender,
            fileHash: fileHash,
            timestamp: block.timestamp
        });
        projectIdByHash[fileHash] = projectId;

        emit ProjectRegistered(projectId, msg.sender, fileHash, block.timestamp);
    }

    function getProject(
        uint256 projectId
    ) external view returns (address owner, bytes32 fileHash, uint256 timestamp) {
        Project memory p = projects[projectId];
        require(p.owner != address(0), "InnovChain: unknown project");
        return (p.owner, p.fileHash, p.timestamp);
    }

    function isHashRegistered(bytes32 fileHash) external view returns (bool) {
        return projectIdByHash[fileHash] != 0;
    }
}
