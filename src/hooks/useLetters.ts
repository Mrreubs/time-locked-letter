import { useState, useEffect, useCallback } from 'react';
import type { Letter } from '../types';

const STORAGE_KEY = 'time-locked-letters';

function loadLetters(): Letter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useLetters() {
  const [letters, setLetters] = useState<Letter[]>(loadLetters);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
  }, [letters]);

  const addLetter = useCallback((letter: Omit<Letter, 'id' | 'createdAt'>) => {
    setLetters((prev) => [
      ...prev,
      {
        ...letter,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const deleteLetter = useCallback((id: string) => {
    setLetters((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { letters, addLetter, deleteLetter };
}
