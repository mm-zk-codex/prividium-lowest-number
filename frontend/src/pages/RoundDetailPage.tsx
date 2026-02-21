import { encodeFunctionData } from 'viem';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';
import { sendPrividiumTx } from '../prividiumTx';

type RoundTuple = [string, bigint, bigint, number, boolean, boolean, `0x${string}`, number];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const formatTime = (ts: bigint) =>
  new Date(Number(ts) * 1000).toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const shortAddress = (address: `0x${string}`) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function RoundDetailPage({ session }: { session: SessionState }) {
  const { id = '0' } = useParams();
  const roundId = BigInt(id);
  const [betNumber, setBetNumber] = useState(1);
  const [round, setRound] = useState<RoundTuple | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [usedBets, setUsedBets] = useState(0);
  const [pendingState, setPendingState] = useState('');
  const [timeNow, setTimeNow] = useState(Math.floor(Date.now() / 1000));

  const load = async () => {
    if (!session.loggedIn || !session.account) {
      setRound(null);
      setWhitelisted(false);
      setUsedBets(0);
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
  }, [id, session.loggedIn, session.account, session.refreshVersion]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const countdownText = useMemo(() => {
    if (!round) return '';
    const [, startTime, endTime, , finishedEarly, finalized] = round;
    const start = Number(startTime);
    const end = Number(endTime);

    if (finalized) return 'Finalized';
    if (finishedEarly || timeNow >= end) return 'Round has ended';

    const toClock = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      return `${min}m ${sec.toString().padStart(2, '0')}s`;
    };

    if (timeNow < start) return `Starts in ${toClock(Math.max(0, start - timeNow))}`;
    return `Ends in ${toClock(Math.max(0, end - timeNow))}`;
  }, [round, timeNow]);

  useEffect(() => {
    if (!round) return;
    const [, startTime, endTime] = round;
    const start = Number(startTime);
    const end = Number(endTime);

    if (timeNow === start || timeNow === end) {
      void session.refreshAppState();
    }
  }, [round, timeNow, session.refreshAppState]);

  const canBet = useMemo(() => {
    if (!round || !session.loggedIn) return false;
    const [, startTime, endTime, betsPerPlayer, finishedEarly, finalized] = round;
    const active = timeNow >= Number(startTime) && timeNow < Number(endTime);
    return whitelisted && active && !finishedEarly && !finalized && usedBets < betsPerPlayer && betNumber >= 1 && betNumber <= 256;
  }, [round, timeNow, usedBets, session.loggedIn, whitelisted, betNumber]);

  const placeBet = async () => {
    if (!session.account || !session.loggedIn || !canBet) return;
    try {
      setPendingState('Submitting...');
      const data = encodeFunctionData({ abi: gameAbi, functionName: 'bet', args: [roundId, betNumber] });
      const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
      setPendingState('Waiting for confirmation...');

      const readClient = getReadClient(session.account);
      await readClient.waitForTransactionReceipt({ hash });

      await session.refreshAppState();
      session.notify('Bet submitted successfully');
      setPendingState('');
    } catch (error) {
      setPendingState('');
      session.notify(error instanceof Error ? `Bet failed: ${error.message}` : 'Bet failed', 'warn');
    }
  };

  const finalize = async () => {
    if (!session.account || !session.loggedIn) return;
    try {
      setPendingState('Submitting...');
      const data = encodeFunctionData({ abi: gameAbi, functionName: 'finalize', args: [roundId] });
      const hash = await sendPrividiumTx({ account: session.account, to: GAME_ADDRESS, data });
      setPendingState('Waiting for confirmation...');

      const readClient = getReadClient(session.account);
      await readClient.waitForTransactionReceipt({ hash });

      await session.refreshAppState();
      session.notify('Round finalized successfully');
      setPendingState('');
    } catch (error) {
      setPendingState('');
      session.notify(error instanceof Error ? `Finalize failed: ${error.message}` : 'Finalize failed', 'warn');
    }
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
  const roundEnded = finishedEarly || timeNow >= Number(endTime);
  const remaining = Math.max(0, betsPerPlayer - usedBets);

  return (
    <section className="stack">
      <article className="card stack">
        <h2>
          Round: {name} <span className="subtle">#{id}</span>
        </h2>
        <p className="subtle">Lowest unique number wins. If no number is unique, there is no winner.</p>
        <p>
          <strong>Starts:</strong> {formatTime(startTime)}
        </p>
        <p>
          <strong>Ends:</strong> {formatTime(endTime)}
        </p>
        <span className="status-badge active">{countdownText}</span>
        <p>
          Bets per player: {betsPerPlayer} · Bets used: {usedBets} · Remaining: {remaining}
        </p>
      </article>

      {!whitelisted ? (
        <article className="card banner warn">You are not eligible to participate in this round.</article>
      ) : null}

      {roundEnded && !finalized ? (
        <article className="card banner warn">
          <strong>⏳ This round has ended.</strong>
        </article>
      ) : null}

      {whitelisted && !roundEnded && !finalized ? (
        <article className="card stack">
          <div className="row">
            <input
              className="input"
              type="number"
              min={1}
              max={256}
              value={betNumber}
              onChange={(e) => setBetNumber(Number(e.target.value))}
              style={{ maxWidth: 220 }}
              disabled={pendingState.length > 0}
            />
            <button className="btn-secondary" onClick={() => setBetNumber(Math.floor(Math.random() * 256) + 1)} disabled={pendingState.length > 0}>
              Random
            </button>
            <button className="btn-primary" disabled={!canBet || pendingState.length > 0} onClick={placeBet}>
              Place bet
            </button>
          </div>
          {pendingState ? <p className="subtle">{pendingState}</p> : null}
        </article>
      ) : null}

      {roundEnded && !finalized ? (
        <button className="btn-primary" onClick={finalize} disabled={pendingState.length > 0}>
          Finalize Round
        </button>
      ) : null}

      {finalized ? (
        <article className="winner-card">
          {winner === ZERO_ADDRESS ? (
            <h2>No winner this round.</h2>
          ) : winner.toLowerCase() === session.account?.toLowerCase() ? (
            <>
              <h2>🎉 Congratulations! You won this round!</h2>
              <p>Winning number: {winningNumber}</p>
            </>
          ) : (
            <>
              <h2>🏆 Winner: {shortAddress(winner)}</h2>
              <p>Winning number: {winningNumber}</p>
            </>
          )}
        </article>
      ) : null}
    </section>
  );
}
