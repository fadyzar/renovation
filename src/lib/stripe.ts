import { loadStripe, type Stripe } from '@stripe/stripe-js';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const stripeConfigured = !!key && key !== 'pk_test_REPLACE_ME';

// Lazy singleton — Stripe.js is loaded ONLY when the payment modal opens.
// This prevents Stripe's SES lockdown from running at app startup and
// conflicting with Framer Motion color animations on the Landing page.
let _promise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!_promise) {
    _promise = stripeConfigured ? loadStripe(key!) : Promise.resolve(null);
  }
  return _promise;
}
