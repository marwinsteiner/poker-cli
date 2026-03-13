import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import { USDC_MINT, USDC_DECIMALS } from './solana-wallet.js';

/**
 * Converts cents (integer) to USDC raw amount (6 decimal places).
 * 1 cent = 0.01 USDC = 10_000 raw units
 */
function centsToRawAmount(cents: number): bigint {
  return BigInt(cents) * BigInt(10_000);
}

export class EscrowManager {
  private escrowKeypair: Keypair;
  private connection: Connection;
  private playerWallets: Map<number, Keypair> = new Map();
  private buyIns: Map<number, number> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
    this.escrowKeypair = Keypair.generate();
  }

  get escrowPublicKey(): PublicKey {
    return this.escrowKeypair.publicKey;
  }

  /**
   * Register a player's wallet for a given seat
   */
  registerPlayer(seatIndex: number, wallet: Keypair): void {
    this.playerWallets.set(seatIndex, wallet);
  }

  /**
   * Collect buy-in from a player: transfer USDC from player wallet to escrow
   */
  async collectBuyIn(seatIndex: number, amountCents: number): Promise<boolean> {
    const wallet = this.playerWallets.get(seatIndex);
    if (!wallet) throw new Error(`No wallet registered for seat ${seatIndex}`);

    try {
      const rawAmount = centsToRawAmount(amountCents);

      // Get or create token accounts
      const playerAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const escrowAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        wallet, // payer for account creation
        USDC_MINT,
        this.escrowKeypair.publicKey,
      );

      // Build and send transfer transaction
      const tx = new Transaction().add(
        createTransferInstruction(
          playerAta,
          escrowAta.address,
          wallet.publicKey,
          rawAmount,
        ),
      );

      await sendAndConfirmTransaction(this.connection, tx, [wallet]);

      this.buyIns.set(seatIndex, (this.buyIns.get(seatIndex) ?? 0) + amountCents);
      return true;
    } catch (err) {
      console.error(`Buy-in failed for seat ${seatIndex}:`, err);
      return false;
    }
  }

  /**
   * Settle a single player: transfer USDC from escrow based on final chip count
   */
  async settlePlayer(seatIndex: number, chipsCents: number): Promise<boolean> {
    if (chipsCents <= 0) return true; // busted, no payout

    const wallet = this.playerWallets.get(seatIndex);
    if (!wallet) throw new Error(`No wallet registered for seat ${seatIndex}`);

    try {
      const rawAmount = centsToRawAmount(chipsCents);

      const escrowAta = await getAssociatedTokenAddress(USDC_MINT, this.escrowKeypair.publicKey);
      const playerAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.escrowKeypair, // payer
        USDC_MINT,
        wallet.publicKey,
      );

      const tx = new Transaction().add(
        createTransferInstruction(
          escrowAta,
          playerAta.address,
          this.escrowKeypair.publicKey,
          rawAmount,
        ),
      );

      await sendAndConfirmTransaction(this.connection, tx, [this.escrowKeypair]);
      return true;
    } catch (err) {
      console.error(`Settlement failed for seat ${seatIndex}:`, err);
      return false;
    }
  }

  /**
   * Settle all players at game end based on their final chip counts
   */
  async settleAll(players: { seatIndex: number; chips: number }[]): Promise<void> {
    for (const { seatIndex, chips } of players) {
      if (!this.playerWallets.has(seatIndex)) continue;
      await this.settlePlayer(seatIndex, chips);
    }
  }

  /**
   * Get the total amount deposited into escrow
   */
  getTotalDeposited(): number {
    let total = 0;
    for (const amount of this.buyIns.values()) {
      total += amount;
    }
    return total;
  }

  /**
   * Check escrow USDC balance
   */
  async getEscrowBalance(): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(USDC_MINT, this.escrowKeypair.publicKey);
      const account = await getAccount(this.connection, ata);
      return Math.floor(Number(account.amount) / 10_000);
    } catch {
      return 0;
    }
  }
}
