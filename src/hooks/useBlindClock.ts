import { useState, useEffect, useRef, useCallback } from 'react';
import type { BlindLevel } from '../engine/types.js';

interface BlindClockState {
  timeRemaining: number;
  currentLevel: number;
  currentBlinds: { small: number; big: number };
  pendingIncrease: boolean;
  nextBlinds: { small: number; big: number } | null;
}

export function useBlindClock(schedule: BlindLevel[] | undefined, active: boolean): BlindClockState & { clearPending: () => void } {
  const [level, setLevel] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(schedule?.[0]?.durationSeconds ?? 0);
  const [pendingIncrease, setPendingIncrease] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!schedule || !active) return;

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - advance to next level
          const currentLevel = levelRef.current;
          const nextLevel = Math.min(currentLevel + 1, schedule.length - 1);
          if (nextLevel !== currentLevel) {
            levelRef.current = nextLevel;
            setLevel(nextLevel);
            setPendingIncrease(true);
          }
          // Reset timer for the new level
          return schedule[nextLevel]?.durationSeconds ?? 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schedule, active]);

  const clearPending = useCallback(() => {
    setPendingIncrease(false);
  }, []);

  if (!schedule) {
    return {
      timeRemaining: 0,
      currentLevel: 0,
      currentBlinds: { small: 0, big: 0 },
      pendingIncrease: false,
      nextBlinds: null,
      clearPending,
    };
  }

  const current = schedule[level] ?? schedule[schedule.length - 1]!;
  const next = schedule[level + 1] ?? null;

  return {
    timeRemaining,
    currentLevel: level,
    currentBlinds: { small: current.small, big: current.big },
    pendingIncrease,
    nextBlinds: next ? { small: next.small, big: next.big } : null,
    clearPending,
  };
}
