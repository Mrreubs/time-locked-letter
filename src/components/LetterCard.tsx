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
      className={`group relative rounded-2xl border p-6 transition-all duration-500 ${
        isUnlocked
          ? 'border-emerald-800/40 bg-gradient-to-b from-emerald-950/25 to-transparent shadow-[0_0_50px_rgba(52,211,153,0.06)]'
          : 'border-zinc-800/40 bg-zinc-900/20 hover:border-zinc-700/50 hover:bg-zinc-900/40'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-1">
            To
          </p>
          <p className="text-lg font-semibold text-zinc-100 truncate">
            {letter.recipient}
          </p>
        </div>
        <button
          onClick={() => onDelete(letter.id)}
          className="shrink-0 ml-3 size-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all duration-200 cursor-pointer text-sm"
          aria-label={`Delete letter to ${letter.recipient}`}
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-zinc-500 flex-wrap">
        {isUnlocked ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            Unlocked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-400 font-mono">
            <span className="size-1.5 rounded-full bg-amber-400" />
            <Countdown target={letter.unlockDate} now={now} />
          </span>
        )}
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-600 text-[13px]">
          {isUnlocked ? 'Unlocked' : 'Unlocks'} {formatDate(letter.unlockDate)}
        </span>
      </div>

      {isUnlocked && (
        <div className="mt-5 pt-5 border-t border-emerald-800/30 animate-[fadeIn_0.6s_ease-out]">
          <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed text-[15px]">
            {letter.content}
          </p>
        </div>
      )}

      {!isUnlocked && (
        <div className="mt-5 pt-5 border-t border-zinc-800/50">
          <p className="text-zinc-700 italic text-sm font-light flex items-center gap-2">
            <span className="text-zinc-700">⌛</span>
            This letter is sealed until its time comes.
          </p>
        </div>
      )}
    </div>
  );
}
