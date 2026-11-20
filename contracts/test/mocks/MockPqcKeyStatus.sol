// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Stands in for the QoreChain PQC Key Status precompile in local tests.
///      Etched at 0x…0a02 with vm.etch; answers are set per account.
contract MockPqcKeyStatus {
    struct Status {
        bool registered;
        uint8 algorithmId;
        bytes pubkey;
        bool possessionProven;
    }

    mapping(address => Status) private _status;

    function set(address account, bool registered, uint8 algorithmId, bool possessionProven) external {
        _status[account] = Status(registered, algorithmId, registered ? new bytes(2592) : bytes(""), possessionProven);
    }

    function pqcKeyStatus(address account) external view returns (bool, uint8, bytes memory, bool) {
        Status storage s = _status[account];
        return (s.registered, s.algorithmId, s.pubkey, s.possessionProven);
    }
}

/// @dev A precompile address that answers with fewer bytes than the real ABI.
contract ShortAnswer {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }
}
