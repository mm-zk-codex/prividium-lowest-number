// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LowestUniqueGame} from "../src/LowestUniqueGame.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract LowestUniqueGameTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    LowestUniqueGame internal game;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA001);

    function setUp() public {
        game = new LowestUniqueGame();
    }

    function _createRound(uint16 betsPerPlayer) internal returns (uint256) {
        address[] memory participants = new address[](3);
        participants[0] = alice;
        participants[1] = bob;
        participants[2] = carol;
        uint64 start = uint64(block.timestamp + 1);
        uint64 end = uint64(block.timestamp + 100);
        return game.createRound(start, end, betsPerPlayer, participants);
    }

    function testLowestUniqueWinnerSingleUnique() public {
        uint256 roundId = _createRound(2);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 3);

        vm.prank(bob);
        game.bet(roundId, 2);

        vm.prank(carol);
        game.bet(roundId, 2);

        vm.warp(block.timestamp + 200);
        (address winner, uint16 winningNumber) = game.finalize(roundId);

        require(winner == alice, "winner should be alice");
        require(winningNumber == 3, "winning number should be 3");
    }

    function testCollisionsRemoveUniqueness() public {
        uint256 roundId = _createRound(3);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 1);

        vm.prank(bob);
        game.bet(roundId, 1);

        vm.prank(carol);
        game.bet(roundId, 5);

        vm.warp(block.timestamp + 200);
        (address winner, uint16 winningNumber) = game.finalize(roundId);

        require(winner == carol, "winner should be carol");
        require(winningNumber == 5, "winning number should be 5");
    }

    function testNoWinnerWhenNoUnique() public {
        uint256 roundId = _createRound(3);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 7);
        vm.prank(bob);
        game.bet(roundId, 7);

        vm.prank(alice);
        game.bet(roundId, 8);
        vm.prank(bob);
        game.bet(roundId, 8);

        vm.warp(block.timestamp + 200);
        (address winner, uint16 winningNumber) = game.finalize(roundId);

        require(winner == address(0), "winner should be zero");
        require(winningNumber == 0, "winning number should be zero");
    }

    function testWhitelistEnforced() public {
        uint256 roundId = _createRound(1);
        vm.warp(block.timestamp + 2);

        vm.prank(address(0xDEAD));
        vm.expectRevert(LowestUniqueGame.NotWhitelisted.selector);
        game.bet(roundId, 10);
    }

    function testBetsPerPlayerEnforced() public {
        uint256 roundId = _createRound(1);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 10);

        vm.prank(alice);
        vm.expectRevert(LowestUniqueGame.BetLimitReached.selector);
        game.bet(roundId, 11);
    }

    function testFinishNowClosesBetting() public {
        uint256 roundId = _createRound(1);
        vm.warp(block.timestamp + 2);

        game.finishNow(roundId);

        vm.prank(alice);
        vm.expectRevert(LowestUniqueGame.RoundFinishedEarly.selector);
        game.bet(roundId, 10);
    }

    function testFinalizeScansAndSetsResult() public {
        uint256 roundId = _createRound(2);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 9);

        vm.warp(block.timestamp + 200);
        game.finalize(roundId);

        (, , , , bool finalized, address winner, uint16 winningNumber) = game.getRoundPublic(roundId);
        require(finalized, "round should be finalized");
        require(winner == alice, "winner mismatch");
        require(winningNumber == 9, "winning number mismatch");
    }

    function testFinalizeIdempotentSecondCallSafe() public {
        uint256 roundId = _createRound(1);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 4);

        vm.warp(block.timestamp + 200);
        (address winner1, uint16 n1) = game.finalize(roundId);
        (address winner2, uint16 n2) = game.finalize(roundId);

        require(winner1 == winner2, "winner changed");
        require(n1 == n2, "number changed");
    }

    function testFinalizeAllowedAfterFinishNow() public {
        uint256 roundId = _createRound(1);
        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        game.bet(roundId, 12);

        game.finishNow(roundId);
        (address winner, uint16 number) = game.finalize(roundId);
        require(winner == alice && number == 12, "finish now finalize failed");
    }
}
