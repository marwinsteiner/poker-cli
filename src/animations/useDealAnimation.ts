import { useAnimation } from './useAnimation.js';

export function useDealAnimation() {
  const { frame, isPlaying, start, reset } = useAnimation(10, 150);

  // Cards appear one at a time: human1(0), ai1(2), human2(5), ai2(7)
  const humanCardsVisible = frame >= 0 ? (frame >= 5 ? 2 : 1) : 0;
  const aiCardsVisible = frame >= 2 ? (frame >= 7 ? 2 : 1) : 0;

  return {
    isPlaying,
    start,
    reset,
    humanCardsVisible,
    aiCardsVisible,
  };
}
