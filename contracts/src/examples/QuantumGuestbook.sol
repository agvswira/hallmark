// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title QuantumGuestbook
/// @notice A sample for trying Hallmark end to end: deploy it from QoreX, verify it, claim it.
///         Only accounts with a registered ML-DSA-87 key can sign, checked on chain through the
///         QoreChain PQC Key Status precompile, so its Hallmark page shows a real PQC report.
contract QuantumGuestbook {
    address public constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;
    uint8 public constant ML_DSA_87 = 1;
    uint256 public constant MAX_NOTE_LENGTH = 140;

    struct Entry {
        address author;
        uint64 signedAt;
        string note;
    }

    Entry[] private _entries;

    event Signed(address indexed author, uint256 indexed index, string note);

    error NoPqcKey(address account);
    error PqcUnavailable();
    error InvalidNote();

    /// @notice Leaves a note. Reverts unless the sender has a registered ML-DSA-87 key.
    function sign(string calldata note) external returns (uint256 index) {
        uint256 len = bytes(note).length;
        if (len == 0 || len > MAX_NOTE_LENGTH) revert InvalidNote();
        if (!hasMlDsaKey(msg.sender)) revert NoPqcKey(msg.sender);
        index = _entries.length;
        _entries.push(Entry(msg.sender, uint64(block.timestamp), note));
        emit Signed(msg.sender, index, note);
    }

    /// @notice Whether `account` has a registered ML-DSA-87 key. Fails closed when the
    ///         precompile is missing or answers short.
    function hasMlDsaKey(address account) public view returns (bool) {
        (bool ok, bytes memory ret) =
            PQC_KEY_STATUS.staticcall(abi.encodeWithSignature("pqcKeyStatus(address)", account));
        // Four head words plus the length word of `pubkey`.
        if (!ok || ret.length < 160) revert PqcUnavailable();
        (bool registered, uint8 algorithmId,,) = abi.decode(ret, (bool, uint8, bytes, bool));
        return registered && algorithmId == ML_DSA_87;
    }

    function count() external view returns (uint256) {
        return _entries.length;
    }

    function entry(uint256 index) external view returns (Entry memory) {
        return _entries[index];
    }
}
