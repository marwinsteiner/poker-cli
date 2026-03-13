import { describe, it, expect } from 'vitest';
import { formatChips, dollarsToCents } from '../engine/chip-format.js';

describe('formatChips', () => {
  it('formats zero', () => {
    expect(formatChips(0)).toBe('$0');
  });

  it('formats whole dollar amounts without decimals', () => {
    expect(formatChips(100)).toBe('$1');
    expect(formatChips(500)).toBe('$5');
    expect(formatChips(1000)).toBe('$10');
    expect(formatChips(20000)).toBe('$200');
  });

  it('formats cents with 2 decimal places', () => {
    expect(formatChips(10)).toBe('$0.10');
    expect(formatChips(25)).toBe('$0.25');
    expect(formatChips(50)).toBe('$0.50');
    expect(formatChips(99)).toBe('$0.99');
  });

  it('formats mixed dollar and cents', () => {
    expect(formatChips(150)).toBe('$1.50');
    expect(formatChips(1050)).toBe('$10.50');
    expect(formatChips(1001)).toBe('$10.01');
    expect(formatChips(2575)).toBe('$25.75');
  });

  it('handles negative amounts', () => {
    expect(formatChips(-100)).toBe('-$1');
    expect(formatChips(-50)).toBe('-$0.50');
  });
});

describe('dollarsToCents', () => {
  it('converts whole dollars', () => {
    expect(dollarsToCents(1)).toBe(100);
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(0)).toBe(0);
  });

  it('converts fractional dollars', () => {
    expect(dollarsToCents(0.25)).toBe(25);
    expect(dollarsToCents(1.50)).toBe(150);
    expect(dollarsToCents(0.01)).toBe(1);
  });

  it('rounds to nearest cent', () => {
    expect(dollarsToCents(0.125)).toBe(13);
    expect(dollarsToCents(0.999)).toBe(100);
  });
});
