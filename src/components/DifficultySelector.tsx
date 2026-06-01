import { useTranslation } from 'react-i18next';
import { DIFFICULTIES, difficultyKey, type Difficulty } from '../lib/difficulty';

// A compact segmented control for picking a difficulty. Light-themed to match
// the rest of the app. Changing the value typically starts a fresh game.
export default function DifficultySelector({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 shadow-inner">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
            value === d ? 'bg-brand text-white shadow' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-pressed={value === d}
        >
          {t(difficultyKey(d))}
        </button>
      ))}
    </div>
  );
}
