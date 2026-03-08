import { useState, useEffect, useCallback, useRef } from 'react';

export function useChipAnimation() {
  const [displayPot, setDisplayPot] = useState(0);
  const [displayWinnerChips, setDisplayWinnerChips] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((potAmount: number, currentWinnerChips: number) => {
    setDisplayPot(potAmount);
    setDisplayWinnerChips(currentWinnerChips);
    setIsPlaying(true);

    const frames = 8;
    const potStep = Math.ceil(potAmount / frames);
    const chipStep = Math.ceil(potAmount / frames);
    let frame = 0;

    intervalRef.current = setInterval(() => {
      frame++;
      setDisplayPot(prev => Math.max(0, prev - potStep));
      setDisplayWinnerChips(prev => prev + chipStep);

      if (frame >= frames) {
        setDisplayPot(0);
        setDisplayWinnerChips(currentWinnerChips + potAmount);
        setIsPlaying(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 100);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { displayPot, displayWinnerChips, isPlaying, start, reset };
}
