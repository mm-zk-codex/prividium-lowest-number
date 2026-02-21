// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LowestUniqueGame {
    uint16 public constant MAX_NUMBER = 256;

    address public immutable admin;
    mapping(address => bool) public isAdmin;
    uint256 public nextRoundId;

    event AdminAdded(address indexed newAdmin);

    error OnlyAdmin();
    error RoundNotFound();
    error InvalidRoundWindow();
    error InvalidBetsPerPlayer();
    error EmptyParticipants();
    error RoundFinalized();
    error RoundFinishedEarly();
    error RoundNotActive();
    error NotWhitelisted();
    error BetLimitReached();
    error InvalidNumber();
    error FinalizeTooEarly();

    struct Round {
        string name;
        uint64 startTime;
        uint64 endTime;
        uint16 betsPerPlayer;
        bool finishedEarly;
        bool finalized;
        address winner;
        uint16 winningNumber;
        mapping(address => bool) whitelisted;
    }

    struct RoundHidden {
        uint16[MAX_NUMBER + 1] count;
        address[MAX_NUMBER + 1] uniqueOwner;
        mapping(address => uint16) usedBets;
    }

    mapping(uint256 => Round) private rounds;
    mapping(uint256 => RoundHidden) private hidden;

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender]) revert OnlyAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
        isAdmin[msg.sender] = true;
    }

    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "ZERO_ADDRESS");
        isAdmin[newAdmin] = true;
        emit AdminAdded(newAdmin);
    }

    function createRound(
        string calldata name,
        uint64 startTime,
        uint64 endTime,
        uint16 betsPerPlayer,
        address[] calldata participants
    ) external onlyAdmin returns (uint256 roundId) {
        if (endTime <= startTime) revert InvalidRoundWindow();
        if (betsPerPlayer == 0) revert InvalidBetsPerPlayer();
        if (participants.length == 0) revert EmptyParticipants();

        roundId = nextRoundId++;
        Round storage round = rounds[roundId];
        round.name = name;
        round.startTime = startTime;
        round.endTime = endTime;
        round.betsPerPlayer = betsPerPlayer;

        for (uint256 i = 0; i < participants.length; i++) {
            round.whitelisted[participants[i]] = true;
        }

        RoundHidden storage hs = hidden[roundId];
        for (uint16 n = 1; n <= MAX_NUMBER; n++) {
            hs.count[n] = 0;
            hs.uniqueOwner[n] = address(0);
        }
    }

    function bet(uint256 roundId, uint16 number) external {
        Round storage round = _getRound(roundId);
        if (round.finalized) revert RoundFinalized();
        if (round.finishedEarly) revert RoundFinishedEarly();
        if (block.timestamp < round.startTime || block.timestamp >= round.endTime) revert RoundNotActive();
        if (!round.whitelisted[msg.sender]) revert NotWhitelisted();
        if (number < 1 || number > MAX_NUMBER) revert InvalidNumber();

        RoundHidden storage hs = hidden[roundId];
        if (hs.usedBets[msg.sender] >= round.betsPerPlayer) revert BetLimitReached();

        hs.usedBets[msg.sender] += 1;
        hs.count[number] += 1;

        uint16 newCount = hs.count[number];
        if (newCount == 1) {
            hs.uniqueOwner[number] = msg.sender;
        } else if (newCount == 2) {
            hs.uniqueOwner[number] = address(0);
        }
    }

    function finishNow(uint256 roundId) external onlyAdmin {
        Round storage round = _getRound(roundId);
        if (round.finalized) revert RoundFinalized();
        round.finishedEarly = true;
    }

    function finalize(uint256 roundId) external returns (address winner, uint16 winningNumber) {
        Round storage round = _getRound(roundId);
        if (round.finalized) {
            return (round.winner, round.winningNumber);
        }
        if (!round.finishedEarly && block.timestamp < round.endTime) revert FinalizeTooEarly();

        RoundHidden storage hs = hidden[roundId];
        for (uint16 n = 1; n <= MAX_NUMBER; n++) {
            if (hs.count[n] == 1) {
                winner = hs.uniqueOwner[n];
                winningNumber = n;
                break;
            }
        }

        round.winner = winner;
        round.winningNumber = winningNumber;
        round.finalized = true;
    }

    function getRoundPublic(
        uint256 roundId
    )
        external
        view
        returns (
            string memory name,
            uint64 startTime,
            uint64 endTime,
            uint16 betsPerPlayer,
            bool finishedEarly,
            bool finalized,
            address winner,
            uint16 winningNumber
        )
    {
        Round storage round = _getRound(roundId);
        return (
            round.name,
            round.startTime,
            round.endTime,
            round.betsPerPlayer,
            round.finishedEarly,
            round.finalized,
            round.winner,
            round.winningNumber
        );
    }

    function isWhitelisted(uint256 roundId, address account) external view returns (bool) {
        Round storage round = _getRound(roundId);
        return round.whitelisted[account];
    }

    function getMyUsedBets(uint256 roundId) external view returns (uint16 used) {
        _getRound(roundId);
        return hidden[roundId].usedBets[msg.sender];
    }

    function _getRound(uint256 roundId) internal view returns (Round storage round) {
        if (roundId >= nextRoundId) revert RoundNotFound();
        round = rounds[roundId];
    }
}
