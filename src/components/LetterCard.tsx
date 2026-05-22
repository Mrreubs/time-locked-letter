import type { Letter } from '../types';
import { Countdown } from './Countdown';

interface Props {
  letter: Letter;
  onDelete: (id: string) => void;
  now: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LetterCard({ letter, onDelete, now }: Props) {
  const isUnlocked = new Date(letter.unlockDate).getTime() <= now;

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-500 ${
        isUnlocked
          ? 'border-emerald-700 bg-emerald-950/40 shadow-[0_0_30px_rgba(52,211,153,0.08)]'
          : 'border-zinc-700 bg-zinc-900/60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-zinc-500">To</p>
          <p className="text-lg font-semibold text-zinc-100">{letter.recipient}</p>
        </div>
        <button
          onClick={() => onDelete(letter.id)}
          className="text-zinc-600 hover:text-red-400 transition-colors text-sm cursor-pointer"
          title="Delete letter"
        >
          ✕
        </button>
      </div>

      <div className="mb-3 text-sm text-zinc-500">
        {isUnlocked ? (
          <span className="text-emerald-400 font-semibold">Unlocked</span>
        ) : (
          <Countdown target={letter.unlockDate} now={now} />
        )}
        <span className="mx-2">·</span>
        <span>Unlocks {formatDate(letter.unlockDate)}</span>
      </div>

      {isUnlocked && (
        <div
          className="mt-3 pt-3 border-t border-emerald-800/50 animate-[fadeIn_0.6s_ease-out]"
        >
          <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {letter.content}
          </p>
        </div>
      )}

      {/* locked overlay hint */}
      {!isUnlocked && (
        <div className="mt-3 pt-3 border-t border-zinc-700">
          <p className="text-zinc-600 italic text-sm">
            This letter is sealed until its time comes.
          </p>
        </div>
      )}
    </div>
  );
}
