/**
 * MOCK PAYMENT SERVICE
 *
 * This module simulates a payment processor for development/demo purposes.
 * The public API surface is intentionally designed to mirror what a real
 * provider integration would look like.
 *
 * ─── TO INTEGRATE A REAL PROVIDER (Stripe / Cardcom / Pelecard) ──────────────
 * 1. Replace the body of `processMockDeposit` with a real API call
 * 2. Keep the same `CardDetails` input and `PaymentResult` output shapes
 * 3. Replace `mock_transaction_id` column usage with the provider's transaction ID
 * 4. Remove the `MOCK-` prefix logic; provider returns real IDs
 * 5. The `paid_at`, `is_deposit`, `deposit_percentage` columns remain valid
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TESTING SHORTCUTS:
 *  - Card ending in 0000  → always declined
 *  - Card ending in 1111  → insufficient funds
 *  - Any other valid card → success
 */

export interface CardDetails {
  /** Formatted: "4242 4242 4242 4242" */
  cardNumber: string;
  cardholderName: string;
  /** Two digits: "03" */
  expiryMonth: string;
  /** Two digits: "27" */
  expiryYear: string;
  cvv: string;
}

export type PaymentErrorCode =
  | 'declined'
  | 'expired_card'
  | 'insufficient_funds'
  | 'network_error'
  | 'invalid_card';

export interface PaymentResult {
  success: boolean;
  /** Unique transaction reference. Prefixed MOCK- for mock; real provider returns its own format. */
  transactionId: string;
  amount: number;
  currency: string;
  timestamp: string;
  /** Last 4 digits of card used — stored for receipt display */
  last4: string;
  errorCode?: PaymentErrorCode;
  errorMessage?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateMockTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MOCK-${ts}-${rand}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isCardExpired(month: string, year: string): boolean {
  const now = new Date();
  const expMonth = parseInt(month, 10);
  const expYear = 2000 + parseInt(year, 10);
  if (expYear < now.getFullYear()) return true;
  if (expYear === now.getFullYear() && expMonth < now.getMonth() + 1) return true;
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Simulate processing a contractor deposit payment.
 *
 * Intentional delay (~2.5 s) to mimic real network + bank round-trip.
 * Replace this function body when integrating a real payment provider.
 */
export async function processMockDeposit(
  amount: number,
  card: CardDetails,
  currency = 'USD'
): Promise<PaymentResult> {
  // Simulate network latency
  await delay(2400 + Math.random() * 600);

  const rawNumber = card.cardNumber.replace(/\s/g, '');
  const last4 = rawNumber.slice(-4);

  // Validation: expired card
  if (isCardExpired(card.expiryMonth, card.expiryYear)) {
    return {
      success: false,
      transactionId: '',
      amount,
      currency,
      timestamp: new Date().toISOString(),
      last4,
      errorCode: 'expired_card',
      errorMessage: 'Your card has expired. Please use a different card.',
    };
  }

  // Test trigger: card ending 0000 → declined
  if (rawNumber.endsWith('0000')) {
    return {
      success: false,
      transactionId: '',
      amount,
      currency,
      timestamp: new Date().toISOString(),
      last4,
      errorCode: 'declined',
      errorMessage: 'Your card was declined. Please try a different payment method.',
    };
  }

  // Test trigger: card ending 1111 → insufficient funds
  if (rawNumber.endsWith('1111')) {
    return {
      success: false,
      transactionId: '',
      amount,
      currency,
      timestamp: new Date().toISOString(),
      last4,
      errorCode: 'insufficient_funds',
      errorMessage: 'Insufficient funds. Please use a card with available credit.',
    };
  }

  // Success
  return {
    success: true,
    transactionId: generateMockTransactionId(),
    amount,
    currency,
    timestamp: new Date().toISOString(),
    last4,
  };
}
