import { preflight, json } from './_cors.mjs';
import { stripeClient } from './_stripe.mjs';
import { getSql } from './_db.mjs';
import { signToken } from './_auth.mjs';
import { z } from 'zod';

const schema = z.object({ session_id: z.string().min(10) });

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'POST only' });

  const sql = getSql();
  if (!sql) return json(500, { ok:false, error:'NEON_DATABASE_URL missing' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json(400, { ok:false, error:'Bad payload', details: parsed.error.flatten() });

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(parsed.data.session_id, { expand: ['subscription', 'customer'] });

  const email = (session?.metadata?.email || session?.customer_details?.email || '').toLowerCase();
  if (!email) return json(400, { ok:false, error:'Email missing in session' });

  const sub = session.subscription;
  const subId = typeof sub === 'string' ? sub : sub?.id;
  const status = typeof sub === 'string' ? null : sub?.status;
  if (!subId) return json(400, { ok:false, error:'No subscription found' });

  const u = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (!u?.length) {
    await sql`INSERT INTO users (email, stripe_customer_id) VALUES (${email}, ${session.customer?.id || null})`;
  } else {
    await sql`UPDATE users SET stripe_customer_id=${session.customer?.id || null} WHERE id=${u[0].id}`;
  }

  const userRow = await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`;
  const userId = userRow[0].id;

  await sql`
    INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_end, price_id)
    VALUES (${userId}, ${subId}, ${status || 'active'}, ${sub?.current_period_end ? new Date(sub.current_period_end*1000).toISOString() : null}, ${process.env.STRIPE_PRICE_ID || null})
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
  `;

  const token = signToken({ email, subscribed: true }, '30d');
  return json(200, { ok:true, token, email, subscribed: true });
};
