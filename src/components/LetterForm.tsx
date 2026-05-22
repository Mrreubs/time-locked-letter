import { type FormEvent, useState } from 'react';

interface Props {
  onSubmit: (data: { recipient: string; content: string; unlockDate: string }) => void;
}

export function LetterForm({ onSubmit }: Props) {
  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [unlockDate, setUnlockDate] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !content.trim() || !unlockDate) return;
    if (new Date(unlockDate).getTime() <= Date.now()) return;
    onSubmit({
      recipient: recipient.trim(),
      content: content.trim(),
      unlockDate: new Date(unlockDate).toISOString(),
    });
    setRecipient('');
    setContent('');
    setUnlockDate('');
  };

  const minDate = new Date().toISOString().slice(0, 16);
  const canSubmit = recipient.trim() && content.trim() && unlockDate;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 p-6 md:p-8 space-y-6"
    >
      <h2 className="text-lg font-semibold text-zinc-100">
        New Letter
      </h2>

      <div>
        <label htmlFor="recipient" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Recipient
        </label>
        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Who is this for?"
          className="w-full bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200 text-[15px]"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Letter
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What do you want to say?"
          rows={4}
          className="w-full bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200 text-[15px] resize-none"
        />
      </div>

      <div>
        <label htmlFor="unlock" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Unlock Date
        </label>
        <input
          id="unlock"
          type="datetime-local"
          value={unlockDate}
          onChange={(e) => setUnlockDate(e.target.value)}
          min={minDate}
          className="w-full bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all duration-200 [color-scheme:dark]"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full font-medium py-2.5 rounded-xl transition-all duration-300 text-[15px] ${
          canSubmit
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/20 hover:shadow-violet-800/30 cursor-pointer active:scale-[0.98]'
            : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
        }`}
      >
        Seal the Letter
      </button>
    </form>
  );
}
