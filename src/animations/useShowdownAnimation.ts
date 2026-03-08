import { useAnimation } from './useAnimation.js';

export function useShowdownAnimation() {
  const { frame, isPlaying, start, reset } = useAnimation(20, 200);

  // AI cards flip at frame 5, highlight at frame 10
  const aiCardsRevealed = frame >= 5;
  const winnerHighlighted = frame >= 10;
  const showHandName = frame >= 12;

  return {
    isPlaying,
    start,
    reset,
    aiCardsRevealed,
    winnerHighlighted,
    showHandName,
  };
}
