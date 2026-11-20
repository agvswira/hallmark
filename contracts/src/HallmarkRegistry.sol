// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev QoreChain PQC Key Status precompile (active on qorechain-diana).
interface IPqcKeyStatus {
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

/// @title HallmarkRegistry
/// @notice Public record of QoreChain contracts whose deployed bytecode was matched
///         against their source by the Hallmark verifier.
/// @dev The registry reads the target's code hash itself at record time, so the
///      verifier can only vouch for the code that is actually on chain. A claim links
///      a hallmarked contract to its repository and can only be made by the contract's
///      deployer from an account with a registered ML-DSA-87 key.
contract HallmarkRegistry {
    address public constant PQC_KEY_STATUS = 0x0000000000000000000000000000000000000a02;
    uint8 public constant ML_DSA_87 = 1;

    /// @dev Bits of `pqcFlags`: which QoreChain PQC precompiles the verified code calls.
    uint8 public constant PQC_USES_VERIFY = 1;
    uint8 public constant PQC_USES_KEY_STATUS = 2;
    uint8 private constant PQC_FLAGS_MASK = PQC_USES_VERIFY | PQC_USES_KEY_STATUS;

    uint256 public constant MAX_TEXT_LENGTH = 256;

    /// @dev Partial: runtime bytecode matches, metadata hash differs.
    ///      Full: runtime bytecode and metadata hash both match.
    enum Match {
        None,
        Partial,
        Full
    }

    struct Hallmark {
        Match matchType;
        uint8 pqcFlags;
        uint64 verifiedAt;
        address deployer;
        bytes32 runtimeCodeHash;
        bytes32 sourceHash;
        string compiler;
        string sourceUri;
    }

    struct Claim {
        address claimant;
        uint64 claimedAt;
        bool possessionProven;
        string repo;
    }

    address public owner;
    address public verifier;

    mapping(address target => Hallmark) private _hallmarks;
    mapping(address target => Claim) private _claims;
    address[] private _targets;

    event Hallmarked(
        address indexed target,
        Match matchType,
        uint8 pqcFlags,
        address indexed deployer,
        bytes32 runtimeCodeHash,
        bytes32 sourceHash,
        string compiler,
        string sourceUri
    );
    event Claimed(address indexed target, address indexed claimant, string repo, bool possessionProven);
    event ClaimCleared(address indexed target, address indexed formerClaimant);
    event VerifierChanged(address indexed previousVerifier, address indexed newVerifier);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotVerifier();
    error ZeroAddress();
    error NoCode(address target);
    error InvalidMatch();
    error InvalidPqcFlags(uint8 flags);
    error InvalidText();
    error Downgrade();
    error NotHallmarked(address target);
    error NotDeployer(address caller, address deployer);
    error PqcUnavailable();
    error NoPqcKey(address account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialVerifier) {
        if (initialVerifier == address(0)) revert ZeroAddress();
        owner = msg.sender;
        verifier = initialVerifier;
        emit OwnershipTransferred(address(0), msg.sender);
        emit VerifierChanged(address(0), initialVerifier);
    }

    // ------------------------------------------------------------------ verifier

    /// @notice Records (or re-records) a verification result for `target`.
    /// @dev Re-recording the same code at a weaker match level is refused, so a
    ///      Full hallmark cannot be silently replaced by a Partial one.
    function recordVerification(
        address target,
        Match matchType,
        uint8 pqcFlags,
        address deployer,
        bytes32 sourceHash,
        string calldata compiler,
        string calldata sourceUri
    ) external {
        if (msg.sender != verifier) revert NotVerifier();
        if (matchType == Match.None) revert InvalidMatch();
        if (pqcFlags & ~PQC_FLAGS_MASK != 0) revert InvalidPqcFlags(pqcFlags);
        if (deployer == address(0)) revert ZeroAddress();
        if (target.code.length == 0) revert NoCode(target);
        _checkText(compiler);
        _checkText(sourceUri);

        bytes32 codeHash = target.codehash;
        Hallmark storage h = _hallmarks[target];

        if (h.matchType == Match.None) {
            _targets.push(target);
        } else {
            if (h.runtimeCodeHash == codeHash && uint8(matchType) < uint8(h.matchType)) revert Downgrade();
            if (h.deployer != deployer && _claims[target].claimant != address(0)) {
                emit ClaimCleared(target, _claims[target].claimant);
                delete _claims[target];
            }
        }

        h.matchType = matchType;
        h.pqcFlags = pqcFlags;
        h.verifiedAt = uint64(block.timestamp);
        h.deployer = deployer;
        h.runtimeCodeHash = codeHash;
        h.sourceHash = sourceHash;
        h.compiler = compiler;
        h.sourceUri = sourceUri;

        emit Hallmarked(target, matchType, pqcFlags, deployer, codeHash, sourceHash, compiler, sourceUri);
    }

    // ------------------------------------------------------------------ deployer

    /// @notice Links a hallmarked contract to its repository.
    /// @dev Only the recorded deployer may claim, and only from an account whose
    ///      ML-DSA-87 key is registered on QoreChain (checked through the precompile).
    function claim(address target, string calldata repo) external {
        Hallmark storage h = _hallmarks[target];
        if (h.matchType == Match.None) revert NotHallmarked(target);
        if (msg.sender != h.deployer) revert NotDeployer(msg.sender, h.deployer);
        _checkText(repo);

        bool possessionProven = _requireMlDsaKey(msg.sender);

        _claims[target] = Claim({
            claimant: msg.sender, claimedAt: uint64(block.timestamp), possessionProven: possessionProven, repo: repo
        });
        emit Claimed(target, msg.sender, repo, possessionProven);
    }

    // ------------------------------------------------------------------ admin

    function setVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();
        emit VerifierChanged(verifier, newVerifier);
        verifier = newVerifier;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------------ views

    function hallmarkOf(address target) external view returns (Hallmark memory) {
        return _hallmarks[target];
    }

    function claimOf(address target) external view returns (Claim memory) {
        return _claims[target];
    }

    /// @notice True when `target` is hallmarked and its code has not changed since.
    function isCurrent(address target) external view returns (bool) {
        Hallmark storage h = _hallmarks[target];
        return h.matchType != Match.None && target.codehash == h.runtimeCodeHash;
    }

    function count() external view returns (uint256) {
        return _targets.length;
    }

    /// @notice Hallmarked contracts in recording order, for paging.
    function targets(uint256 start, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _targets.length;
        if (start >= total) return new address[](0);
        uint256 end = start + limit > total ? total : start + limit;
        page = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            page[i - start] = _targets[i];
        }
    }

    // ------------------------------------------------------------------ internal

    /// @dev An inactive precompile address answers with success and empty data, so the
    ///      return length is checked before decoding.
    function _requireMlDsaKey(address account) private view returns (bool possessionProven) {
        (bool ok, bytes memory ret) = PQC_KEY_STATUS.staticcall(abi.encodeCall(IPqcKeyStatus.pqcKeyStatus, (account)));
        // Four head words plus the length word of `pubkey`.
        if (!ok || ret.length < 160) revert PqcUnavailable();
        (bool registered, uint8 algorithmId,, bool proven) = abi.decode(ret, (bool, uint8, bytes, bool));
        if (!registered || algorithmId != ML_DSA_87) revert NoPqcKey(account);
        return proven;
    }

    function _checkText(string calldata text) private pure {
        uint256 len = bytes(text).length;
        if (len == 0 || len > MAX_TEXT_LENGTH) revert InvalidText();
    }
}
