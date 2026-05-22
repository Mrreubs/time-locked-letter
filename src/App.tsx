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
    <div className="min-h-svh bg-[#09090b] text-zinc-300 font-sans antialiased">
      <div className="max-w-4xl mx-auto px-5 py-16 md:py-24">
        <header className="text-center mb-16 md:mb-20">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent leading-none pb-3">
            Time-Locked Letters
          </h1>
          <p className="mt-4 text-zinc-500 text-base md:text-lg font-light tracking-wide">
            Words that wait until the world is ready.
          </p>
        </header>

        <div className="flex justify-center mb-14">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-7 py-3 rounded-xl transition-all duration-300 cursor-pointer shadow-lg shadow-violet-900/20 hover:shadow-violet-800/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="text-lg leading-none">✦</span>
              <span>Write a Letter</span>
            </button>
          ) : (
            <div className="w-full max-w-lg animate-[slideDown_0.35s_ease-out]">
              <LetterForm
                onSubmit={(data) => {
                  addLetter(data);
                  setShowForm(false);
                }}
              />
              <button
                onClick={() => setShowForm(false)}
                className="mt-3 text-sm text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer w-full text-center"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-24 select-none">
            <div className="text-6xl mb-6 opacity-30">✧</div>
            <p className="text-xl text-zinc-700 font-light">No letters yet.</p>
            <p className="text-sm text-zinc-800 mt-2 font-light">
              Write one to your future self or someone you care about.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {sorted.map((letter, i) => (
              <div
                key={letter.id}
                className="animate-[scaleIn_0.4s_ease-out_both]"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <LetterCard
                  letter={letter}
                  onDelete={deleteLetter}
                  now={now}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
