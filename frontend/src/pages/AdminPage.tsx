import { useState } from 'react';
import { encodeFunctionData } from 'viem';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, walletClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

export function AdminPage() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [betsPerPlayer, setBetsPerPlayer] = useState(1);
  const [participants, setParticipants] = useState('');
  const [roundId, setRoundId] = useState('0');
  const [status, setStatus] = useState('');

  const withAccount = async () => {
    const [account] = await walletClient.requestAddresses();
    return account;
  };

  const createRound = async () => {
    const account = await withAccount();
    const list = participants.split(',').map((x) => x.trim()) as `0x${string}`[];
    const data = encodeFunctionData({
      abi: gameAbi,
      functionName: 'createRound',
      args: [BigInt(startTime), BigInt(endTime), betsPerPlayer, list]
    });
    const hash = await sendPrividiumTx({ account, to: GAME_ADDRESS, data });
    setStatus(`Create round tx: ${hash}`);
  };

  const finishNow = async () => {
    const account = await withAccount();
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finishNow', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account, to: GAME_ADDRESS, data });
    setStatus(`Finish-now tx: ${hash}`);
  };

  const finalize = async () => {
    const account = await withAccount();
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account, to: GAME_ADDRESS, data });
    setStatus(`Finalize tx: ${hash}`);
  };

  return (
    <section>
      <h2>Admin</h2>
      <div>
        <h3>Create round</h3>
        <input placeholder="start unix" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <input placeholder="end unix" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <input
          type="number"
          placeholder="bets/player"
          value={betsPerPlayer}
          onChange={(e) => setBetsPerPlayer(Number(e.target.value))}
        />
        <textarea
          placeholder="comma separated participants"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
        />
        <button onClick={createRound}>Create</button>
      </div>
      <div>
        <h3>Round actions</h3>
        <input placeholder="round id" value={roundId} onChange={(e) => setRoundId(e.target.value)} />
        <button onClick={finishNow}>Finish now</button>
        <button onClick={finalize}>Finalize</button>
      </div>
      <p>{status}</p>
    </section>
  );
}
