import { useState, useEffect, useRef } from 'react';

/**
 * Per-player action countdown timer.
 * Counts down when `active` is true, calls `onTimeout` at 0.
 * Resets when active transitions false→true.
 */
export function useActionClock(
  timeLimitSec: number | undefined,
  active: boolean,
  onTimeout: () => void,
): { secondsRemaining: number } {
  const [seconds, setSeconds] = useState(timeLimitSec ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasActive = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!timeLimitSec) return;

    // Reset timer when active transitions false → true
    if (active && !wasActive.current) {
      setSeconds(timeLimitSec);
    }
    wasActive.current = active;

    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          // Time's up - auto fold
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeout(() => onTimeoutRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timeLimitSec, active]);

  return { secondsRemaining: seconds };
}
