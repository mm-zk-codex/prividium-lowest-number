import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gameAbi } from '../abi';
import { GAME_ADDRESS, getReadClient, prividium, walletClient } from '../config';

type RoundData = {
  id: bigint;
  startTime: bigint;
  endTime: bigint;
  betsPerPlayer: number;
  finishedEarly: boolean;
  finalized: boolean;
  winner: `0x${string}`;
  winningNumber: number;
};

export function RoundListPage() {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        if (!prividium.isAuthorized()) {
          await prividium.authorize({ scopes: ['wallet:required', 'network:required'] });
        }

        const [account] = await walletClient.requestAddresses();
        const readClient = getReadClient(account);

        const total = (await readClient.readContract({
          address: GAME_ADDRESS,
          abi: gameAbi,
          functionName: 'nextRoundId'
        })) as bigint;

        const values: RoundData[] = [];
        for (let i = 0n; i < total; i++) {
          const [startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber] =
            (await readClient.readContract({
              address: GAME_ADDRESS,
              abi: gameAbi,
              functionName: 'getRoundPublic',
              args: [i]
            })) as [bigint, bigint, number, boolean, boolean, `0x${string}`, number];

          values.push({ id: i, startTime, endTime, betsPerPlayer, finishedEarly, finalized, winner, winningNumber });
        }
        setRounds(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rounds');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const now = Math.floor(Date.now() / 1000);

  return (
    <section>
      <h2>Rounds</h2>
      {loading ? <p>Loading rounds...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      <ul>
        {rounds.map((r) => {
          const countdown = now < Number(r.startTime) ? Number(r.startTime) - now : Number(r.endTime) - now;
          return (
            <li key={r.id.toString()}>
              <Link to={`/round/${r.id.toString()}`}>Round {r.id.toString()}</Link> · bets/player: {r.betsPerPlayer} ·
              {r.finalized
                ? r.winner === '0x0000000000000000000000000000000000000000'
                  ? ' No winner'
                  : ` winner ${r.winner} @ ${r.winningNumber}`
                : ` countdown ${countdown}s`}
              {r.finishedEarly && !r.finalized ? ' · ended early' : ''}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
