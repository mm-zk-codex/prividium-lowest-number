import { useEffect, useState } from 'react';
import { encodeFunctionData } from 'viem';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

export function AdminPage({ session }: { session: SessionState }) {
  const [name, setName] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [betsPerPlayer, setBetsPerPlayer] = useState(1);
  const [participants, setParticipants] = useState('');
  const [roundId, setRoundId] = useState('0');
  const [newAdmin, setNewAdmin] = useState('');
  const [status, setStatus] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!session.account || !session.loggedIn) {
        setIsAdmin(false);
        return;
      }
      const readClient = getReadClient(session.account);
      const value = (await readClient.readContract({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: 'isAdmin',
        args: [session.account]
      })) as boolean;
      setIsAdmin(value);
    };
    void load();
  }, [session.account, session.loggedIn, session.refreshVersion]);

  const waitForTx = async (hash: `0x${string}`, successMessage: string) => {
    if (!session.account) return;
    const readClient = getReadClient(session.account);
    await readClient.waitForTransactionReceipt({ hash });
    await session.refreshAppState();
    session.notify(successMessage);
  };

  const createRound = async () => {
    if (!session.account || !session.loggedIn) return;
    if (!startTimeInput || !endTimeInput) {
      session.notify('Please select start and end time.', 'warn');
      return;
    }

    const startTime = Math.floor(new Date(startTimeInput).getTime() / 1000);
    const endTime = Math.floor(new Date(endTimeInput).getTime() / 1000);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
      session.notify('Please provide a valid time range.', 'warn');
      return;
    }

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
    await waitForTx(hash, 'Round created successfully');
  };

  const finishNow = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finishNow', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Finish-now tx: ${hash}`);
    await waitForTx(hash, 'Round finished early');
  };

  const finalize = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [BigInt(roundId)] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Finalize tx: ${hash}`);
    await waitForTx(hash, 'Round finalized successfully');
  };

  const addAdmin = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'addAdmin', args: [newAdmin as `0x${string}`] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Add admin tx: ${hash}`);
    await waitForTx(hash, 'Admin added successfully');
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
      <article className="card stack fade-in">
        <h2>Admin Panel</h2>
        <p className="subtle">Create and manage rounds with private bets.</p>
        {isAdmin ? <span className="status-badge active">You are admin</span> : <span className="status-badge ended">You are not admin</span>}
      </article>

      {isAdmin ? (
        <>
          <article className="card stack fade-in">
            <h3>Create Round</h3>
            <label>
              <span className="label">Round name (required)</span>
              <input className="input" placeholder="Friday Night Round" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span className="label">Starts at</span>
              <input className="input" type="datetime-local" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} />
            </label>
            <label>
              <span className="label">Ends at</span>
              <input className="input" type="datetime-local" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} />
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

          <article className="card stack fade-in">
            <h3>Manage Round</h3>
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

          <article className="card stack fade-in">
            <h3>Add admin</h3>
            <label>
              <span className="label">New admin address</span>
              <input className="input" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} placeholder="0x..." />
            </label>
            <button className="btn-primary" onClick={addAdmin}>
              Add admin
            </button>
          </article>
        </>
      ) : (
        <article className="card">
          You are not an admin on this contract. Admin actions are hidden.
        </article>
      )}

      {status ? (
        <article className="card fade-in">
          <div className="pending-indicator">
            <span className="spinner" />
            {status}
          </div>
        </article>
      ) : null}
    </section>
  );
}
