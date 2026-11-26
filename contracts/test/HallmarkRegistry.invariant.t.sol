// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {HallmarkRegistry} from "../src/HallmarkRegistry.sol";
import {MockPqcKeyStatus} from "./mocks/MockPqcKeyStatus.sol";

contract SampleCodeA {
    uint256 public v = 1;
}

contract SampleCodeB {
    uint256 public v = 2;

    function bump() external {
        v += 1;
    }
}

/// @notice Stateful fuzz handler driving HallmarkRegistry across valid and adversarial calls.
contract HallmarkHandler is Test {
    HallmarkRegistry public immutable registry;
    MockPqcKeyStatus public immutable pqc;
    address public immutable ownerAddr;

    address[4] public targets;
    address[4] public actors;
    address public currentVerifier;
    bytes private altCode;

    // Ghost state: active runtimeCodeHash that has achieved Full (cleared only if replaced by a different codeHash).
    mapping(address target => bytes32) public activeFullCodeHash;
    mapping(address target => address) public expectedDeployer;

    constructor(HallmarkRegistry _registry, MockPqcKeyStatus _pqc, address _ownerAddr, address _initialVerifier) {
        registry = _registry;
        pqc = _pqc;
        ownerAddr = _ownerAddr;
        currentVerifier = _initialVerifier;
        altCode = type(SampleCodeB).runtimeCode;

        for (uint256 i; i < 4; i++) {
            targets[i] = address(new SampleCodeA());
            actors[i] = makeAddr(string.concat("actor-", vm.toString(i)));
        }
    }

    function record(uint8 targetIdx, uint8 matchChoice, uint8 pqcFlags, uint8 deployerIdx, bytes32 srcHash, bool spoof)
        external
    {
        address target = targets[targetIdx % 4];
        address deployer = actors[deployerIdx % 4];
        HallmarkRegistry.Match m = HallmarkRegistry.Match(bound(matchChoice, 0, 2));
        uint8 flags = pqcFlags & 3;
        bytes32 codeHashBefore = target.codehash;
        bytes32 prevRecordedHash = registry.hallmarkOf(target).runtimeCodeHash;

        address caller = spoof ? actors[0] : currentVerifier;
        vm.prank(caller);
        try registry.recordVerification(
            target, m, flags, deployer, srcHash, "0.8.28+commit.7893614a", "https://hallmark.example/c/1"
        ) {
            if (m == HallmarkRegistry.Match.Full) {
                activeFullCodeHash[target] = codeHashBefore;
            } else if (codeHashBefore != prevRecordedHash) {
                activeFullCodeHash[target] = bytes32(0);
            }
            expectedDeployer[target] = deployer;
        } catch {}
    }

    function swapTargetCode(uint8 targetIdx, bool toAlt) external {
        address target = targets[targetIdx % 4];
        vm.etch(target, toAlt ? altCode : type(SampleCodeA).runtimeCode);
    }

    function setPqcKey(uint8 actorIdx, bool registered, uint8 algoId, bool proven) external {
        address actor = actors[actorIdx % 4];
        uint8 normalizedAlgo = algoId % 3;
        pqc.set(actor, registered, normalizedAlgo, proven);
    }

    function claim(uint8 targetIdx, uint8 actorIdx, bool validRepo) external {
        address target = targets[targetIdx % 4];
        address actor = actors[actorIdx % 4];
        string memory repo = validRepo ? "https://github.com/agvswira/hallmark" : "";

        vm.prank(actor);
        try registry.claim(target, repo) {} catch {}
    }

    function rotateVerifier(uint8 newVerifierIdx) external {
        address next = actors[newVerifierIdx % 4];
        vm.prank(ownerAddr);
        try registry.setVerifier(next) {
            currentVerifier = next;
        } catch {}
    }

    function targetCount() external pure returns (uint256) {
        return 4;
    }

    function targetAt(uint256 idx) external view returns (address) {
        return targets[idx];
    }
}

contract HallmarkRegistryInvariantTest is Test {
    HallmarkRegistry registry;
    MockPqcKeyStatus pqc;
    HallmarkHandler handler;

    function setUp() public {
        address initialVerifier = makeAddr("initialVerifier");
        registry = new HallmarkRegistry(initialVerifier);

        MockPqcKeyStatus impl = new MockPqcKeyStatus();
        vm.etch(registry.PQC_KEY_STATUS(), address(impl).code);
        pqc = MockPqcKeyStatus(registry.PQC_KEY_STATUS());

        handler = new HallmarkHandler(registry, pqc, address(this), initialVerifier);
        targetContract(address(handler));
    }

    function invariant_NoDuplicateTargetsAndCountMatches() public view {
        uint256 n = registry.count();
        address[] memory listed = registry.targets(0, n + 5);
        assertEq(listed.length, n);
        for (uint256 i; i < n; i++) {
            assertTrue(registry.hallmarkOf(listed[i]).matchType != HallmarkRegistry.Match.None);
            for (uint256 j = i + 1; j < n; j++) {
                assertTrue(listed[i] != listed[j]);
            }
        }
    }

    function invariant_FullNeverDowngradedForSameCode() public view {
        uint256 n = handler.targetCount();
        for (uint256 i; i < n; i++) {
            address t = handler.targetAt(i);
            HallmarkRegistry.Hallmark memory h = registry.hallmarkOf(t);
            bytes32 fullHash = handler.activeFullCodeHash(t);
            if (fullHash != bytes32(0) && h.runtimeCodeHash == fullHash) {
                assertEq(uint8(h.matchType), uint8(HallmarkRegistry.Match.Full));
            }
        }
    }

    function invariant_ClaimOnlyMatchesHallmarkedDeployer() public view {
        uint256 n = handler.targetCount();
        for (uint256 i; i < n; i++) {
            address t = handler.targetAt(i);
            HallmarkRegistry.Hallmark memory h = registry.hallmarkOf(t);
            HallmarkRegistry.Claim memory c = registry.claimOf(t);
            if (c.claimant != address(0)) {
                assertTrue(h.matchType != HallmarkRegistry.Match.None);
                assertEq(c.claimant, h.deployer);
                assertGt(bytes(c.repo).length, 0);
                assertLe(bytes(c.repo).length, registry.MAX_TEXT_LENGTH());
            }
        }
    }

    function invariant_ValidPqcFlagsAndMetadataBounds() public view {
        uint256 n = handler.targetCount();
        for (uint256 i; i < n; i++) {
            address t = handler.targetAt(i);
            HallmarkRegistry.Hallmark memory h = registry.hallmarkOf(t);
            if (h.matchType != HallmarkRegistry.Match.None) {
                assertLe(h.pqcFlags, 3);
                assertTrue(h.deployer != address(0));
                assertGt(bytes(h.compiler).length, 0);
                assertLe(bytes(h.compiler).length, registry.MAX_TEXT_LENGTH());
                assertGt(bytes(h.sourceUri).length, 0);
                assertLe(bytes(h.sourceUri).length, registry.MAX_TEXT_LENGTH());
            }
        }
    }

    function invariant_IsCurrentMatchesLiveCodeHash() public view {
        uint256 n = handler.targetCount();
        for (uint256 i; i < n; i++) {
            address t = handler.targetAt(i);
            HallmarkRegistry.Hallmark memory h = registry.hallmarkOf(t);
            bool expected = h.matchType != HallmarkRegistry.Match.None && t.codehash == h.runtimeCodeHash;
            assertEq(registry.isCurrent(t), expected);
        }
    }
}
