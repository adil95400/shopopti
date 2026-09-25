import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(baseDir, '..', path), 'utf8');

const checkout = read('supabase/functions/stripe-checkout/index.ts');
const portal = read('supabase/functions/stripe-customer-portal/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const client = read('src/lib/stripe.ts');
const pricing = read('src/pages/Pricing.tsx');
const legacyCheckout = read('backend/api/stripe_checkout.py');
const legacyWebhook = read('backend/api/stripe_webhook.py');

const assertions = [
  [checkout.includes('service.auth.getUser(token)'), 'checkout must derive user from JWT'],
  [checkout.includes('.from("subscription_plans")'), 'checkout must resolve plan server-side'],
  [checkout.includes('stripe_price_id_monthly'), 'checkout must use server-side Stripe Price mapping'],
  [checkout.includes('invalid_billing_cycle'), 'checkout must reject unsupported billing cycles'],
  [checkout.includes('subscription_already_exists'), 'checkout must prevent duplicate subscriptions'],
  [checkout.includes('trial_period_days'), 'checkout must apply trial configuration server-side'],
  [!checkout.includes('payload.price_id'), 'checkout must not accept price_id from client'],
  [!checkout.includes('payload.user_id'), 'checkout must not accept user_id from client'],
  [!checkout.includes('payload.customer_id'), 'checkout must not accept customer_id from client'],
  [!checkout.includes('payload.success_url'), 'checkout must not accept success_url from client'],
  [!checkout.includes('payload.cancel_url'), 'checkout must not accept cancel_url from client'],
  [portal.includes('service.auth.getUser(token)'), 'portal must derive user from JWT'],
  [!portal.includes('customer_id') || !portal.includes('payload.customer_id'), 'portal must not trust client customer_id'],
  [webhook.includes('await req.text()'), 'webhook must verify the raw request body'],
  [webhook.includes('constructEventAsync'), 'webhook must verify Stripe signature asynchronously'],
  [webhook.includes('STRIPE_WEBHOOK_SECRET'), 'webhook must require Stripe webhook secret'],
  [webhook.includes('.from("stripe_webhooks")'), 'webhook must persist idempotency records'],
  [webhook.includes('processed: false'), 'webhook must record unprocessed events before work'],
  [webhook.includes('processed: true'), 'webhook must mark processed events after success'],
  [webhook.includes('insertError?.code === "23505"'), 'webhook must stop concurrent duplicate processing'],
  [client.includes("body: {\n      plan,\n      billing_cycle: billingCycle"), 'client must send plan + cycle only'],
  [!client.includes('price_id:'), 'client must not send Stripe Price IDs'],
  [!client.includes('customer_id:'), 'client must not send Stripe customer IDs'],
  [!pricing.includes('VITE_STRIPE_PRICE_PRO'), 'pricing must not depend on browser Stripe Price IDs'],
  [pricing.includes(".from('subscription_plans')"), 'pricing must read plan prices from the server configuration'],
  [pricing.includes("setBillingCycle('yearly')"), 'pricing must support yearly billing selection'],
  [legacyCheckout.includes('status_code=410'), 'legacy checkout must fail closed'],
  [legacyWebhook.includes('status_code=410'), 'legacy webhook must fail closed']
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length > 0) {
  console.error('Stripe golden path contract failed:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Stripe golden path contract passed.');
