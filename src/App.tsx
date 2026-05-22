import { useEffect, useMemo, useState } from 'react';
import { useLetters } from './hooks/useLetters';
import { LetterForm } from './components/LetterForm';
import { LetterCard } from './components/LetterCard';

export default function App() {
  const { letters, addLetter, deleteLetter } = useLetters();
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(
    () => [...letters].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [letters]
  );

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
            ⌛ Time-Locked Letters
          </h1>
          <p className="mt-2 text-zinc-500">
            Words that wait until the world is ready.
          </p>
        </header>

        {/* new letter button */}
        {!showForm && (
          <div className="text-center mb-10">
            <button
              onClick={() => setShowForm(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              ✦ Write a Letter
            </button>
          </div>
        )}

        {/* form */}
        {showForm && (
          <div className="mb-10">
            <LetterForm
              onSubmit={(data) => {
                addLetter(data);
                setShowForm(false);
              }}
            />
            <button
              onClick={() => setShowForm(false)}
              className="mt-2 text-sm text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* letters */}
        {sorted.length === 0 ? (
          <div className="text-center py-20 text-zinc-700">
            <p className="text-5xl mb-4">✉️</p>
            <p className="text-lg">No letters yet.</p>
            <p className="text-sm mt-1">Write one to your future self or someone you care about.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onDelete={deleteLetter}
                now={now}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
