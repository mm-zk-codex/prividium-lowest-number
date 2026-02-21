export const gameAbi = [
  {
    type: 'function',
    name: 'nextRoundId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getRoundPublic',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'roundId' }],
    outputs: [
      { type: 'uint64', name: 'startTime' },
      { type: 'uint64', name: 'endTime' },
      { type: 'uint16', name: 'betsPerPlayer' },
      { type: 'bool', name: 'finishedEarly' },
      { type: 'bool', name: 'finalized' },
      { type: 'address', name: 'winner' },
      { type: 'uint16', name: 'winningNumber' }
    ]
  },
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [
      { type: 'uint256', name: 'roundId' },
      { type: 'address', name: 'account' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    type: 'function',
    name: 'createRound',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint64', name: 'startTime' },
      { type: 'uint64', name: 'endTime' },
      { type: 'uint16', name: 'betsPerPlayer' },
      { type: 'address[]', name: 'participants' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'bet',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'roundId' },
      { type: 'uint16', name: 'number' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'finishNow',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'roundId' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'finalize',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'roundId' }],
    outputs: [
      { type: 'address', name: 'winner' },
      { type: 'uint16', name: 'winningNumber' }
    ]
  }
] as const;
