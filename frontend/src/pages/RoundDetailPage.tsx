import { encodeFunctionData } from 'viem';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

type RoundTuple = [string, bigint, bigint, number, boolean, boolean, `0x${string}`, number];

export function RoundDetailPage({ session }: { session: SessionState }) {
  const { id = '0' } = useParams();
  const roundId = BigInt(id);
  const [number, setNumber] = useState(1);
  const [status, setStatus] = useState('');
  const [round, setRound] = useState<RoundTuple | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [usedBets, setUsedBets] = useState(0);

  const load = async () => {
    if (!session.loggedIn || !session.account) {
      setRound(null);
      return;
    }

    const readClient = getReadClient(session.account);

    const data = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'getRoundPublic',
      args: [roundId]
    })) as RoundTuple;
    setRound(data);

    const allowed = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'isWhitelisted',
      args: [roundId, session.account]
    })) as boolean;
    setWhitelisted(allowed);

    const used = (await readClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: 'getMyUsedBets',
      args: [roundId]
    })) as number;
    setUsedBets(used);
  };

  useEffect(() => {
    void load();
  }, [id, session.loggedIn, session.account]);

  const now = Math.floor(Date.now() / 1000);

  const canBet = useMemo(() => {
    if (!round || !session.loggedIn) return false;
    const [, startTime, endTime, betsPerPlayer, finishedEarly, finalized] = round;
    const active = now >= Number(startTime) && now < Number(endTime);
    return whitelisted && active && !finishedEarly && !finalized && usedBets < betsPerPlayer;
  }, [round, now, usedBets, session.loggedIn, whitelisted]);

  const placeBet = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'bet', args: [roundId, number] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Bet submitted: ${hash}`);
    await load();
  };

  const finalize = async () => {
    if (!session.account || !session.loggedIn) return;
    const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [roundId] });
    const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
    setStatus(`Finalize submitted: ${hash}`);
    await load();
  };

  if (!session.loggedIn) {
    return (
      <section className="card">
        <h2>Round #{id}</h2>
        <p>You must log in to view your whitelist status and place bets.</p>
      </section>
    );
  }

  if (!round) return <section className="card">Loading...</section>;
  const [name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] = round;
  const showFinalize = now >= Number(endTime) || finishedEarly;
  const remaining = Math.max(0, betsPerPlayer - usedBets);

  return (
    <section className="card stack">
      <h2>
        Round: {name} <span className="subtle">#{id}</span>
      </h2>
      <p>
        Start: {new Date(Number(startTime) * 1000).toLocaleString()} ({startTime.toString()})
      </p>
      <p>
        End: {new Date(Number(endTime) * 1000).toLocaleString()} ({endTime.toString()})
      </p>
      <p>{whitelisted ? 'You are whitelisted for this round.' : 'You are not whitelisted for this round.'}</p>
      <p>
        Bets per player: {betsPerPlayer} · Bets used (contract): {usedBets} · Remaining: {remaining}
      </p>

      <div className="row">
        <input
          className="input"
          type="number"
          min={1}
          max={256}
          value={number}
          onChange={(e) => setNumber(Number(e.target.value))}
          style={{ maxWidth: 220 }}
        />
        <button className="btn-primary" disabled={!canBet} onClick={placeBet}>
          Place bet
        </button>
      </div>

      {showFinalize && !finalized ? (
        <button className="btn-secondary" onClick={finalize}>
          Finalize round
        </button>
      ) : null}
      {finalized ? <p>{winner === '0x0000000000000000000000000000000000000000' ? 'No winner' : `Winner ${winner} with ${winningNumber}`}</p> : null}
      <p>{status}</p>
    </section>
  );
}
