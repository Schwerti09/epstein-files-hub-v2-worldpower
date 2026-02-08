import { preflight, json } from './_cors.mjs';
import { stripeClient } from './_stripe.mjs';
import { getSql } from './_db.mjs';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'POST only' });

  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = process.env.SITE_URL || 'http://localhost:8888';
  if (!priceId) return json(500, { ok:false, error:'STRIPE_PRICE_ID missing' });

  const sql = getSql();
  if (!sql) return json(500, { ok:false, error:'NEON_DATABASE_URL missing' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json(400, { ok:false, error:'Bad payload', details: parsed.error.flatten() });

  const stripe = stripeClient();

  const email = parsed.data.email.toLowerCase();
  const existing = await sql`SELECT id, stripe_customer_id FROM users WHERE email = ${email} LIMIT 1`;
  let customerId = existing?.[0]?.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
    if (existing?.length) {
      await sql`UPDATE users SET stripe_customer_id=${customerId} WHERE id=${existing[0].id}`;
    } else {
      await sql`INSERT INTO users (email, stripe_customer_id) VALUES (${email}, ${customerId})`;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/subscribe/success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/subscribe/?canceled=1`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { email } },
    metadata: { email }
  });

  return json(200, { ok:true, url: session.url });
};
