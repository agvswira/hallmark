// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {QuantumGuestbook} from "../src/examples/QuantumGuestbook.sol";
import {MockPqcKeyStatus, ShortAnswer} from "./mocks/MockPqcKeyStatus.sol";

contract QuantumGuestbookTest is Test {
    QuantumGuestbook book;
    MockPqcKeyStatus pqc;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        book = new QuantumGuestbook();
        vm.etch(book.PQC_KEY_STATUS(), address(new MockPqcKeyStatus()).code);
        pqc = MockPqcKeyStatus(book.PQC_KEY_STATUS());
        pqc.set(alice, true, 1, true);
    }

    function test_SignWithKey() public {
        vm.expectEmit(true, true, false, true);
        emit QuantumGuestbook.Signed(alice, 0, "hello from diana");
        vm.prank(alice);
        assertEq(book.sign("hello from diana"), 0);
        assertEq(book.count(), 1);
        QuantumGuestbook.Entry memory e = book.entry(0);
        assertEq(e.author, alice);
        assertEq(e.note, "hello from diana");
    }

    function test_RevertWithoutKey() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(QuantumGuestbook.NoPqcKey.selector, bob));
        book.sign("hi");
    }

    function test_RevertWithOtherAlgorithm() public {
        pqc.set(bob, true, 2, true);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(QuantumGuestbook.NoPqcKey.selector, bob));
        book.sign("hi");
    }

    function test_RevertOnBadNote() public {
        vm.startPrank(alice);
        vm.expectRevert(QuantumGuestbook.InvalidNote.selector);
        book.sign("");
        vm.expectRevert(QuantumGuestbook.InvalidNote.selector);
        book.sign(string(new bytes(141)));
        vm.stopPrank();
    }

    function test_FailsClosedOnShortAnswer() public {
        vm.etch(book.PQC_KEY_STATUS(), address(new ShortAnswer()).code);
        vm.prank(alice);
        vm.expectRevert(QuantumGuestbook.PqcUnavailable.selector);
        book.sign("hi");
    }

    function test_FailsClosedWithoutPrecompile() public {
        vm.etch(book.PQC_KEY_STATUS(), "");
        vm.prank(alice);
        vm.expectRevert(QuantumGuestbook.PqcUnavailable.selector);
        book.sign("hi");
    }
}
