import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DIFFICULTIES,
  DIFFICULTY_STYLE,
  difficultyKey,
  type Difficulty,
} from '../lib/difficulty';
import type { GameDef } from '../games/registry';
import { sound } from '../lib/sound';
import { isCloudConfigured } from '../lib/supabase';
import GameArt from './GameArt';
import { Icon } from './Icons';
import { GAME_BG } from './GameShell';

// The pre-game screen (HOLO 2.0): the game's emblem on a holo-bordered tile,
// then the ways to play — Play Online (iridescent, when supported) above the
// four AI difficulty rows. Each row is a full-width glass slab with the
// difficulty's signature color as a left accent + star rating, ≥52px tall.
export default function DifficultyScreen({ game }: { game: GameDef }) {
  const { t } = useTranslation();
  const nav = useNavigate();

  const choose = (d: Difficulty) => {
    sound.playSelectDifficulty();
    nav(`/play/${game.id}/${d}`);
  };

  return (
    <div
      className="flex h-full flex-col items-center overflow-y-auto px-5 py-8 text-white"
      style={{ background: GAME_BG }}
    >
      <div className="flex w-full max-w-md flex-col items-center pb-6">
        <div className="holo-border flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-space-2 to-space-3">
          <GameArt id={game.id} className="h-14 w-14 text-white/95" />
        </div>

        <h1 className="font-display mt-4 text-2xl text-white">{t(game.nameKey)}</h1>
        <p className="mt-1 text-sm text-white/55">{t(game.taglineKey)}</p>

        {game.online && isCloudConfigured && (
          <button
            onClick={() => {
              sound.playSelectDifficulty();
              nav(`/online/${game.id}`);
            }}
            className="mt-6 flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-5 py-4 font-semibold text-white shadow-glow transition-premium active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 font-display text-lg tracking-wide">
              <Icon name="globe" className="h-5 w-5" />
              {t('online.playOnline')}
            </span>
            <span className="text-sm text-white/85">{t('online.vsHuman')}</span>
          </button>
        )}

        <div className="mt-3 flex w-full flex-col gap-2.5">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {t('difficulty.choose')}
          </div>
          {DIFFICULTIES.map((d) => {
            const s = DIFFICULTY_STYLE[d];
            return (
              <button
                key={d}
                onClick={() => choose(d)}
                className="glass-panel relative flex min-h-[56px] items-center justify-between overflow-hidden rounded-2xl px-5 py-3.5 transition-premium hover:bg-white/[0.08] active:scale-[0.98]"
              >
                {/* Difficulty signature color as a left edge accent. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ background: s.color }}
                />
                <span className="font-display text-lg tracking-wide text-white">
                  {t(difficultyKey(d))}
                </span>
                <span
                  className="flex items-center gap-0.5"
                  aria-label={`${s.stars} stars`}
                  style={{ color: s.color }}
                >
                  {Array.from({ length: 4 }, (_, i) => (
                    <Icon
                      key={i}
                      name="star"
                      className={`h-4 w-4 ${i < s.stars ? 'fill-current' : 'opacity-25'}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
