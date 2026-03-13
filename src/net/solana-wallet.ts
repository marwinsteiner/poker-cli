import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { readFileSync } from 'fs';

// Solana mainnet USDC mint address
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDC_DECIMALS = 6;

/**
 * Load a Solana keypair from a JSON file (Solana CLI format: array of bytes)
 */
export function loadWalletFromFile(path: string): Keypair {
  const raw = readFileSync(path, 'utf-8');
  const secretKey = new Uint8Array(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Load a Solana keypair from a base58-encoded private key
 */
export function loadWalletFromKey(base58Key: string): Keypair {
  const bytes = base58Decode(base58Key);
  return Keypair.fromSecretKey(bytes);
}

/**
 * Get USDC balance for a wallet in cents (1 cent = 0.01 USDC)
 */
export async function getUSDCBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, publicKey);
    const account = await getAccount(connection, ata);
    // USDC has 6 decimals: 1 USDC = 1_000_000 raw units
    // 1 cent = 10_000 raw units
    const cents = Number(account.amount) / 10_000;
    return Math.floor(cents);
  } catch {
    // Token account doesn't exist = 0 balance
    return 0;
  }
}

// Simple base58 decoder (Bitcoin alphabet)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base58 character: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Handle leading '1's (zeros in base58)
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}
