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
import { GAME_BG } from './GameShell';

// A dedicated screen between the game grid and play: pick a difficulty (★1–★4,
// green→red) before the game starts. Headings use the cyber-silver dot font.
export default function DifficultyScreen({ game }: { game: GameDef }) {
  const { t } = useTranslation();
  const nav = useNavigate();

  const choose = (d: Difficulty) => {
    sound.playSelectDifficulty();
    nav(`/play/${game.id}/${d}`);
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-5 py-8 text-white" style={{ background: GAME_BG }}>
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-cyan text-white shadow-premium">
          <GameArt id={game.id} className="h-12 w-12" />
        </div>

        <h1 className="font-cyber mt-4 text-2xl">{t(game.nameKey)}</h1>
        <p className="font-dot mt-1 flex items-center gap-1 text-sm text-white/60">
          <span className="text-amber-400">★</span>
          {t('difficulty.choose')}
        </p>

        {game.online && isCloudConfigured && (
          <button
            onClick={() => {
              sound.playSelectDifficulty();
              nav(`/online/${game.id}`);
            }}
            className="mt-6 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-accent-cyan px-5 py-4 font-semibold text-white shadow-premium transition active:scale-[0.98]"
          >
            <span className="font-dot text-lg font-bold tracking-wide">🌐 {t('online.playOnline')}</span>
            <span className="text-sm text-white/80">{t('online.vsHuman')}</span>
          </button>
        )}

        <div className="mt-3 flex w-full flex-col gap-3">
          {DIFFICULTIES.map((d) => {
            const s = DIFFICULTY_STYLE[d];
            return (
              <button
                key={d}
                onClick={() => choose(d)}
                className={`flex items-center justify-between rounded-2xl px-5 py-4 shadow-md ring-1 ring-black/5 transition active:scale-[0.98] ${s.bg} ${s.hover} ${s.text}`}
              >
                <span className="font-dot text-lg font-bold tracking-wide">
                  {t(difficultyKey(d))}
                </span>
                <span className="text-base tracking-widest" aria-label={`${s.stars} stars`}>
                  {'★'.repeat(s.stars)}
                  <span className="opacity-30">{'★'.repeat(4 - s.stars)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
