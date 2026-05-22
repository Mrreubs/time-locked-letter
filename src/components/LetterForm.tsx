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

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-zinc-100">New Letter</h2>

      <div>
        <label htmlFor="recipient" className="block text-sm text-zinc-400 mb-1">
          Recipient
        </label>
        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Who is this for?"
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm text-zinc-400 mb-1">
          Letter
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What do you want to say?"
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
      </div>

      <div>
        <label htmlFor="unlock" className="block text-sm text-zinc-400 mb-1">
          Unlock Date
        </label>
        <input
          id="unlock"
          type="datetime-local"
          value={unlockDate}
          onChange={(e) => setUnlockDate(e.target.value)}
          min={minDate}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 rounded-lg transition-colors cursor-pointer"
      >
        Seal the Letter
      </button>
    </form>
  );
}
