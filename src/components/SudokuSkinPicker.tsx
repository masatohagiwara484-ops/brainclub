import { useTranslation } from 'react-i18next';
import { SUDOKU_THEMES, getSudokuSkinId, setSudokuSkin } from '../lib/gameSkins';
import { isUnlocked } from '../lib/inventory';
import { useMonetization } from '../lib/monetization';
import RarityTile from './RarityTile';

// In-game Sudoku theme picker — a mini 3×3 preview per theme in the rarity
// language. Locked themes open the paywall. (The board redraws live via the
// gameSkins pub/sub used by useSudokuTheme.)
export default function SudokuSkinPicker({ onPick }: { onPick?: () => void }) {
  const { t } = useTranslation();
  const m = useMonetization();
  const plan = m.getPlan();
  const sel = getSudokuSkinId();
  return (
    <div className="grid grid-cols-4 gap-2">
      {SUDOKU_THEMES.map((th) => {
        const unlocked = isUnlocked(th.unlock, plan, `sudoku-${th.id}`);
        return (
          <RarityTile
            key={th.id}
            rarity={th.rarity}
            selected={sel === th.id}
            locked={!unlocked}
            ariaLabel={t(th.nameKey)}
            onClick={() => {
              if (!unlocked) return m.openPaywall();
              setSudokuSkin(th.id);
              onPick?.();
            }}
          >
            <span
              className="grid h-9 w-9 grid-cols-3 grid-rows-3 overflow-hidden rounded-md ring-1 ring-white/15"
              style={{ background: th.boardBg }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="grid place-items-center text-[7px] font-bold leading-none"
                  style={{
                    color: i % 2 === 0 ? th.given : th.user,
                    boxShadow: `inset 0 0 0 0.5px ${th.line}`,
                  }}
                >
                  {((i * 3 + 1) % 9) + 1}
                </span>
              ))}
            </span>
            <span className="text-[8px] font-semibold text-white/55">{t(th.nameKey)}</span>
          </RarityTile>
        );
      })}
    </div>
  );
}
