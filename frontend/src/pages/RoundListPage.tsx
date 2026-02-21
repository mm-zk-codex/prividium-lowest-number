import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionState } from '../App';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient } from '../config';

type RoundData = {
  id: bigint;
  name: string;
  startTime: bigint;
  endTime: bigint;
  betsPerPlayer: number;
  finishedEarly: boolean;
  finalized: boolean;
  winner: `0x${string}`;
  winningNumber: number;
};

export function RoundListPage({ session }: { session: SessionState }) {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!session.loggedIn || !session.account) {
        setRounds([]);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const readClient = getReadClient(session.account);

        const total = (await readClient.readContract({
          address: GAME_ADDRESS,
          abi: gameAbi,
          functionName: 'nextRoundId'
        })) as bigint;

        const values: RoundData[] = [];
        for (let i = 0n; i < total; i++) {
          const [name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] =
            (await readClient.readContract({
              address: GAME_ADDRESS,
              abi: gameAbi,
              functionName: 'getRoundPublic',
              args: [i]
            })) as [string, bigint, bigint, number, boolean, boolean, `0x${string}`, number];

          values.push({ id: i, name, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber });
        }
        setRounds(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rounds');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [session.loggedIn, session.account, session.refreshVersion]);

  const now = Math.floor(Date.now() / 1000);

  const getStatus = (round: RoundData): 'Finalized' | 'Finished Early' | 'Upcoming' | 'Active' | 'Ended' => {
    if (round.finalized) return 'Finalized';
    if (round.finishedEarly) return 'Finished Early';
    if (now < Number(round.startTime)) return 'Upcoming';
    if (now < Number(round.endTime)) return 'Active';
    return 'Ended';
  };

  const formatTime = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <section className="stack">
      <div className="card">
        <h2>Rounds</h2>
        {!session.loggedIn ? <p>You must log in to view your whitelist status and place bets.</p> : null}
        {loading ? <p>Loading rounds...</p> : null}
        {error ? <p style={{ color: '#fca5a5' }}>{error}</p> : null}
      </div>

      {!loading && session.loggedIn && rounds.length === 0 ? <article className="card">No rounds available yet.</article> : null}

      {rounds.map((r) => {
        const status = getStatus(r);
        return (
        <article className="card" key={r.id.toString()}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{r.name}</h3>
              <p className="subtle">Round ID #{r.id.toString()}</p>
            </div>
            <span className={`status-badge ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
          </div>
          <p>
            <strong>Starts:</strong> {formatTime(r.startTime)}
          </p>
          <p>
            <strong>Ends:</strong> {formatTime(r.endTime)}
          </p>
          <p>
            <strong>Bets/player:</strong> {r.betsPerPlayer}
          </p>
          {r.finalized ? (
            <p>{r.winner === '0x0000000000000000000000000000000000000000' ? 'No winner' : `Winner ${r.winner} @ ${r.winningNumber}`}</p>
          ) : null}
          <Link to={`/round/${r.id.toString()}`}>Open round</Link>
        </article>
        );
      })}
    </section>
  );
}
