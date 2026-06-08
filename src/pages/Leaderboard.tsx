import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games/registry';
import { DIFFICULTIES, type Difficulty } from '../lib/difficulty';
import { useCloud } from '../lib/cloud';
import { useDailyBoard, useLadder } from '../lib/leaderboard';
import { tierForScore } from '../lib/tiers';
import { GAME_BG } from '../components/GameShell';

// The Leaderboard tab: a daily board (per game + difficulty, same seed for all
// players) and the all-time global skill ladder (by Synapse score). Reading the
// boards needs a signed-in session (RLS), so we soft-gate with a sign-in nudge.
export default function Leaderboard() {
  const { t } = useTranslation();
  const cloud = useCloud();
  const [view, setView] = useState<'today' | 'global'>('today');

  const playable = useMemo(() => GAMES.filter((g) => g.available && g.component), []);
  const [gameId, setGameId] = useState(playable[0]?.id ?? 'reaction');
  const game = playable.find((g) => g.id === gameId) ?? playable[0];
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const diffParam = game?.hasDifficulty ? difficulty : '';

  const signedIn = cloud.status === 'signed-in';

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="font-cyber text-2xl">{t('leaderboard.title')}</h1>
        <p className="mt-1 text-sm text-white/60">{t('leaderboard.sub')}</p>

        {/* View switch */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.06] p-1">
          {(['today', 'global'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-xl py-2 text-sm font-bold transition ${
                view === v ? 'bg-primary text-white shadow-premium' : 'text-white/55'
              }`}
            >
              {t(`leaderboard.${v}`)}
            </button>
          ))}
        </div>

        {/* Sign-in nudge (soft gate) */}
        {cloud.status !== 'disabled' && !signedIn && (
          <Link
            to="/profile"
            className="mt-4 block rounded-2xl border border-accent-cyan/30 bg-accent-cyan/10 p-3 text-center text-sm font-semibold text-accent-cyan"
          >
            {t('leaderboard.signInToCompete')}
          </Link>
        )}

        {view === 'today' ? (
          <>
            {/* Game picker */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {playable.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGameId(g.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    g.id === gameId ? 'bg-primary text-white' : 'bg-white/[0.06] text-white/60'
                  }`}
                >
                  {t(g.nameKey)}
                </button>
              ))}
            </div>

            {/* Difficulty picker (only for difficulty-enabled games) */}
            {game?.hasDifficulty && (
              <div className="mt-2 flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                      d === difficulty ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/45'
                    }`}
                  >
                    {t(`difficulty.${d}`)}
                  </button>
                ))}
              </div>
            )}

            <DailyBoard gameId={gameId} difficulty={diffParam} youId={cloud.account?.userId} />
          </>
        ) : (
          <GlobalLadder youId={cloud.account?.userId} />
        )}
      </div>
    </div>
  );
}

const rowCls = (you: boolean) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 ${you ? 'bg-accent-cyan/15 ring-1 ring-accent-cyan/40' : 'bg-white/[0.04]'}`;

function rankBadge(rank: number) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-white/50">{medal ?? rank}</span>
  );
}

function DailyBoard({ gameId, difficulty, youId }: { gameId: string; difficulty: string; youId?: string }) {
  const { t } = useTranslation();
  const { rows, loading } = useDailyBoard(gameId, difficulty);

  if (loading) return <p className="mt-6 text-center text-sm text-white/40">…</p>;
  if (rows.length === 0) return <p className="mt-8 text-center text-sm text-white/45">{t('leaderboard.empty')}</p>;

  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((r) => {
        const detail = Object.values(r.detail)[0];
        return (
          <div key={r.userId} className={rowCls(r.userId === youId)}>
            {rankBadge(r.rank)}
            <span className="text-xl">{r.avatar}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.username}</span>
            <span className="text-right text-sm font-black tabular-nums text-accent-cyan">
              {detail != null ? String(detail) : r.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GlobalLadder({ youId }: { youId?: string }) {
  const { t } = useTranslation();
  const { rows, loading } = useLadder();

  if (loading) return <p className="mt-6 text-center text-sm text-white/40">…</p>;
  if (rows.length === 0) return <p className="mt-8 text-center text-sm text-white/45">{t('leaderboard.empty')}</p>;

  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((r) => {
        const tier = tierForScore(r.synapse);
        return (
          <div key={r.userId} className={rowCls(r.userId === youId)}>
            {rankBadge(r.rank)}
            <span className="text-xl">{r.avatar}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{r.username}</div>
              <span className="text-[11px] font-bold" style={{ color: tier.color }}>
                {t(tier.nameKey)} · Lv {r.level}
              </span>
            </div>
            <span className="text-right text-sm font-black tabular-nums text-accent-cyan">{r.synapse}</span>
          </div>
        );
      })}
    </div>
  );
}
