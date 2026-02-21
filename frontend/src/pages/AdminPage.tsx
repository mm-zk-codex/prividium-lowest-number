import { useState } from 'react';
import { encodeFunctionData } from 'viem';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

export function AdminPage({ session }: { session: SessionState }) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [betsPerPlayer, setBetsPerPlayer] = useState(1);
  const [participants, setParticipants] = useState('');
  const [roundId, setRoundId] = useState('0');
  const [newAdmin, setNewAdmin] = useState('');
  const [status, setStatus] = useState('');

  const createRound = async () => {
    if (!session.account || !session.loggedIn) return;
    const list = participants
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean) as `0x${string}`[];

    const data = encodeFunctionData({
      abi: gameAbi,
      functionName: 'createRound',
      args: [name, BigInt(startTime), BigInt(endTime), betsPerPlayer, list]
    });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Create round tx: ${hash}`);
  };

  const finishNow = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finishNow', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Finish-now tx: ${hash}`);
  };

  const finalize = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Finalize tx: ${hash}`);
  };

  const addAdmin = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'addAdmin', args: [newAdmin as `0x${string}`] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Add admin tx: ${hash}`);
  };

  if (!session.loggedIn) {
    return (
      <section className="card">
        <h2>Admin</h2>
        <p>You must log in to view your whitelist status and place bets.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="card stack">
        <h2>Admin Panel</h2>
        <p className="subtle">Create and manage rounds with private bets.</p>
      </article>

      <article className="card stack">
        <h3>Create round</h3>
        <label>
          <span className="label">Round name (required)</span>
          <input className="input" placeholder="Friday Night Round" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="label">Start unix</span>
          <input className="input" placeholder="1735689600" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          <span className="label">End unix</span>
          <input className="input" placeholder="1735693200" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <label>
          <span className="label">Bets per player</span>
          <input className="input" type="number" value={betsPerPlayer} onChange={(e) => setBetsPerPlayer(Number(e.target.value))} />
        </label>
        <label>
          <span className="label">Participants (comma-separated addresses)</span>
          <textarea className="textarea" rows={4} value={participants} onChange={(e) => setParticipants(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={createRound}>
          Create round
        </button>
      </article>

      <article className="card stack">
        <h3>Round actions</h3>
        <label>
          <span className="label">Round ID</span>
          <input className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn-secondary" onClick={finishNow}>
            Finish early
          </button>
          <button className="btn-primary" onClick={finalize}>
            Finalize
          </button>
        </div>
      </article>

      <article className="card stack">
        <h3>Add admin</h3>
        <label>
          <span className="label">New admin address</span>
          <input className="input" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} placeholder="0x..." />
        </label>
        <button className="btn-primary" onClick={addAdmin}>
          Add admin
        </button>
      </article>

      <article className="card">{status}</article>
    </section>
  );
}
