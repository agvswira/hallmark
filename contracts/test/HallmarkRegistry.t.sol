// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {HallmarkRegistry} from "../src/HallmarkRegistry.sol";
import {MockPqcKeyStatus, ShortAnswer} from "./mocks/MockPqcKeyStatus.sol";

contract Target {
    uint256 public value = 1;
}

contract OtherTarget {
    uint256 public value = 2;

    function extra() external pure returns (uint256) {
        return 3;
    }
}

contract HallmarkRegistryTest is Test {
    HallmarkRegistry registry;
    MockPqcKeyStatus pqc;

    address owner = address(this);
    address verifier = makeAddr("verifier");
    address deployer = makeAddr("deployer");
    address stranger = makeAddr("stranger");
    address target;

    bytes32 constant SOURCE_HASH = keccak256("standard-json-input");
    string constant COMPILER = "0.8.28+commit.7893614a";
    string constant URI = "https://hallmark.example/s/abc";
    string constant REPO = "https://github.com/agvswira/hallmark";

    function setUp() public {
        registry = new HallmarkRegistry(verifier);
        target = address(new Target());

        MockPqcKeyStatus impl = new MockPqcKeyStatus();
        vm.etch(registry.PQC_KEY_STATUS(), address(impl).code);
        pqc = MockPqcKeyStatus(registry.PQC_KEY_STATUS());
    }

    function _record(address t, HallmarkRegistry.Match m, uint8 flags, address dep) internal {
        vm.prank(verifier);
        registry.recordVerification(t, m, flags, dep, SOURCE_HASH, COMPILER, URI);
    }

    // ------------------------------------------------------------ constructor/admin

    function test_ConstructorSetsRoles() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.verifier(), verifier);
    }

    function test_ConstructorRejectsZeroVerifier() public {
        vm.expectRevert(HallmarkRegistry.ZeroAddress.selector);
        new HallmarkRegistry(address(0));
    }

    function test_SetVerifierOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(HallmarkRegistry.NotOwner.selector);
        registry.setVerifier(stranger);

        registry.setVerifier(stranger);
        assertEq(registry.verifier(), stranger);
    }

    function test_SetVerifierRejectsZero() public {
        vm.expectRevert(HallmarkRegistry.ZeroAddress.selector);
        registry.setVerifier(address(0));
    }

    function test_TransferOwnership() public {
        vm.prank(stranger);
        vm.expectRevert(HallmarkRegistry.NotOwner.selector);
        registry.transferOwnership(stranger);

        registry.transferOwnership(stranger);
        assertEq(registry.owner(), stranger);

        vm.expectRevert(HallmarkRegistry.NotOwner.selector);
        registry.setVerifier(owner);
    }

    function test_OldVerifierLosesAccess() public {
        registry.setVerifier(stranger);
        vm.prank(verifier);
        vm.expectRevert(HallmarkRegistry.NotVerifier.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Full, 0, deployer, SOURCE_HASH, COMPILER, URI);
    }

    // ------------------------------------------------------------ recording

    function test_RecordStoresOnChainCodeHash() public {
        _record(target, HallmarkRegistry.Match.Full, registry.PQC_USES_VERIFY(), deployer);

        HallmarkRegistry.Hallmark memory h = registry.hallmarkOf(target);
        assertEq(uint8(h.matchType), uint8(HallmarkRegistry.Match.Full));
        assertEq(h.pqcFlags, registry.PQC_USES_VERIFY());
        assertEq(h.deployer, deployer);
        assertEq(h.runtimeCodeHash, target.codehash);
        assertEq(h.sourceHash, SOURCE_HASH);
        assertEq(h.compiler, COMPILER);
        assertEq(h.sourceUri, URI);
        assertEq(h.verifiedAt, block.timestamp);
        assertTrue(registry.isCurrent(target));
        assertEq(registry.count(), 1);
    }

    function test_RecordEmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit HallmarkRegistry.Hallmarked(
            target, HallmarkRegistry.Match.Partial, 3, deployer, target.codehash, SOURCE_HASH, COMPILER, URI
        );
        _record(target, HallmarkRegistry.Match.Partial, 3, deployer);
    }

    function test_RecordOnlyVerifier() public {
        vm.prank(stranger);
        vm.expectRevert(HallmarkRegistry.NotVerifier.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Full, 0, deployer, SOURCE_HASH, COMPILER, URI);
    }

    function test_RecordRejectsAccountWithoutCode() public {
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.NoCode.selector, stranger));
        registry.recordVerification(stranger, HallmarkRegistry.Match.Full, 0, deployer, SOURCE_HASH, COMPILER, URI);
    }

    function test_RecordRejectsNoneMatch() public {
        vm.prank(verifier);
        vm.expectRevert(HallmarkRegistry.InvalidMatch.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.None, 0, deployer, SOURCE_HASH, COMPILER, URI);
    }

    function test_RecordRejectsZeroDeployer() public {
        vm.prank(verifier);
        vm.expectRevert(HallmarkRegistry.ZeroAddress.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Full, 0, address(0), SOURCE_HASH, COMPILER, URI);
    }

    function testFuzz_RecordRejectsUnknownPqcFlags(uint8 flags) public {
        vm.assume(flags > 3);
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.InvalidPqcFlags.selector, flags));
        registry.recordVerification(target, HallmarkRegistry.Match.Full, flags, deployer, SOURCE_HASH, COMPILER, URI);
    }

    function test_RecordRejectsEmptyOrLongText() public {
        vm.startPrank(verifier);
        vm.expectRevert(HallmarkRegistry.InvalidText.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Full, 0, deployer, SOURCE_HASH, "", URI);

        string memory long = string(new bytes(registry.MAX_TEXT_LENGTH() + 1));
        vm.expectRevert(HallmarkRegistry.InvalidText.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Full, 0, deployer, SOURCE_HASH, COMPILER, long);
        vm.stopPrank();
    }

    function test_ReRecordDoesNotDuplicateListing() public {
        _record(target, HallmarkRegistry.Match.Partial, 0, deployer);
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        assertEq(registry.count(), 1);
        assertEq(uint8(registry.hallmarkOf(target).matchType), uint8(HallmarkRegistry.Match.Full));
    }

    function test_DowngradeOfSameCodeRefused() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        vm.prank(verifier);
        vm.expectRevert(HallmarkRegistry.Downgrade.selector);
        registry.recordVerification(target, HallmarkRegistry.Match.Partial, 0, deployer, SOURCE_HASH, COMPILER, URI);
    }

    function test_ChangedCodeIsNotCurrentAndMayBeReRecorded() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        vm.etch(target, type(OtherTarget).runtimeCode);
        assertFalse(registry.isCurrent(target));

        // New code: a Partial match is allowed again, and the stored hash follows the chain.
        _record(target, HallmarkRegistry.Match.Partial, 0, deployer);
        assertTrue(registry.isCurrent(target));
        assertEq(registry.hallmarkOf(target).runtimeCodeHash, target.codehash);
    }

    function test_IsCurrentFalseWhenNotHallmarked() public view {
        assertFalse(registry.isCurrent(target));
    }

    function test_TargetsPaging() public {
        address[] memory ts = new address[](5);
        for (uint256 i; i < 5; i++) {
            ts[i] = address(new Target());
            _record(ts[i], HallmarkRegistry.Match.Full, 0, deployer);
        }
        address[] memory page = registry.targets(1, 3);
        assertEq(page.length, 3);
        assertEq(page[0], ts[1]);
        assertEq(page[2], ts[3]);

        assertEq(registry.targets(4, 10).length, 1);
        assertEq(registry.targets(5, 10).length, 0);
        assertEq(registry.targets(99, 1).length, 0);
    }

    // ------------------------------------------------------------ claims

    function test_ClaimByDeployerWithMlDsaKey() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(deployer, true, 1, true);

        vm.expectEmit(true, true, false, true, address(registry));
        emit HallmarkRegistry.Claimed(target, deployer, REPO, true);
        vm.prank(deployer);
        registry.claim(target, REPO);

        HallmarkRegistry.Claim memory c = registry.claimOf(target);
        assertEq(c.claimant, deployer);
        assertEq(c.repo, REPO);
        assertTrue(c.possessionProven);
        assertEq(c.claimedAt, block.timestamp);
    }

    function test_ClaimRecordsMissingProofOfPossession() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(deployer, true, 1, false);
        vm.prank(deployer);
        registry.claim(target, REPO);
        assertFalse(registry.claimOf(target).possessionProven);
    }

    function test_ClaimRequiresHallmark() public {
        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.NotHallmarked.selector, target));
        registry.claim(target, REPO);
    }

    function test_ClaimOnlyDeployer() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(stranger, true, 1, true);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.NotDeployer.selector, stranger, deployer));
        registry.claim(target, REPO);
    }

    function test_ClaimRequiresRegisteredKey() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.NoPqcKey.selector, deployer));
        registry.claim(target, REPO);
    }

    function test_ClaimRequiresMlDsa87Algorithm() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(deployer, true, 2, true);
        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(HallmarkRegistry.NoPqcKey.selector, deployer));
        registry.claim(target, REPO);
    }

    function test_ClaimFailsClosedWhenPrecompileInactive() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        // An inactive precompile address has no code: the call succeeds with empty data.
        vm.etch(registry.PQC_KEY_STATUS(), "");
        vm.prank(deployer);
        vm.expectRevert(HallmarkRegistry.PqcUnavailable.selector);
        registry.claim(target, REPO);
    }

    function test_ClaimFailsClosedOnShortAnswer() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        vm.etch(registry.PQC_KEY_STATUS(), address(new ShortAnswer()).code);
        vm.prank(deployer);
        vm.expectRevert(HallmarkRegistry.PqcUnavailable.selector);
        registry.claim(target, REPO);
    }

    function test_ClaimRejectsEmptyRepo() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(deployer, true, 1, true);
        vm.prank(deployer);
        vm.expectRevert(HallmarkRegistry.InvalidText.selector);
        registry.claim(target, "");
    }

    function test_DeployerChangeClearsClaim() public {
        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        pqc.set(deployer, true, 1, true);
        vm.prank(deployer);
        registry.claim(target, REPO);

        vm.expectEmit(true, true, false, false, address(registry));
        emit HallmarkRegistry.ClaimCleared(target, deployer);
        _record(target, HallmarkRegistry.Match.Full, 0, stranger);
        assertEq(registry.claimOf(target).claimant, address(0));
    }

    function test_SameDeployerReRecordKeepsClaim() public {
        _record(target, HallmarkRegistry.Match.Partial, 0, deployer);
        pqc.set(deployer, true, 1, true);
        vm.prank(deployer);
        registry.claim(target, REPO);

        _record(target, HallmarkRegistry.Match.Full, 0, deployer);
        assertEq(registry.claimOf(target).claimant, deployer);
    }
}
