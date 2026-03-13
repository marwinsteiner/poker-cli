export const CENTS_PER_DOLLAR = 100;

export function formatChips(cents: number): string {
  if (cents === 0) return '$0';
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remaining = Math.abs(cents) % 100;
  const sign = cents < 0 ? '-' : '';
  if (remaining === 0) return `${sign}$${dollars}`;
  return `${sign}$${dollars}.${remaining.toString().padStart(2, '0')}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
