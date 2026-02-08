import Stripe from 'stripe';
import { getSql } from './_db.mjs';

export const handler = async (event) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  const sql = getSql();

  if (!secret || !key) return { statusCode: 500, body: 'Stripe secrets missing' };
  if (!sql) return { statusCode: 500, body: 'NEON_DATABASE_URL missing' };

  const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

  let stripeEvent;
  try {
    const sig = event.headers['stripe-signature'];
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err?.message);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  try {
    if (['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(stripeEvent.type)) {
      const sub = stripeEvent.data.object;
      const customerId = sub.customer;
      let email = (sub.metadata?.email || '').toLowerCase();

      if (!email && customerId) {
        const cust = await stripe.customers.retrieve(customerId);
        if (cust?.email) email = cust.email.toLowerCase();
      }
      if (!email) return { statusCode: 200, body: 'ok' };

      const existing = await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`;
      let userId;
      if (!existing?.length) {
        const ins = await sql`INSERT INTO users (email, stripe_customer_id) VALUES (${email}, ${customerId}) RETURNING id`;
        userId = ins[0].id;
      } else {
        userId = existing[0].id;
        await sql`UPDATE users SET stripe_customer_id=${customerId} WHERE id=${userId}`;
      }

      const status = sub.status;
      const cpe = sub.current_period_end ? new Date(sub.current_period_end*1000).toISOString() : null;
      const priceId = sub.items?.data?.[0]?.price?.id || null;

      await sql`
        INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_end, price_id)
        VALUES (${userId}, ${sub.id}, ${status}, ${cpe}, ${priceId})
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET
          status = EXCLUDED.status,
          current_period_end = EXCLUDED.current_period_end,
          price_id = EXCLUDED.price_id,
          updated_at = NOW()
      `;
    }
  } catch (e) {
    console.error('Webhook processing error:', e);
    return { statusCode: 500, body: 'Webhook processing failed' };
  }

  return { statusCode: 200, body: 'ok' };
};
