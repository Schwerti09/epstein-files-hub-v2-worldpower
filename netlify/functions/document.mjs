import { preflight, json } from './_cors.mjs';
import { getSql } from './_db.mjs';
import { verifyTokenFromHeaders } from './_auth.mjs';
import { z } from 'zod';

const schema = z.object({ slug: z.string().min(1).max(200) });

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'GET only' });

  const sql = getSql();
  if (!sql) return json(500, { ok:false, error:'NEON_DATABASE_URL missing' });

  const slug = event.queryStringParameters?.slug;
  const q = event.queryStringParameters?.q || '';
  const qLike = q ? ('%' + q + '%') : null;

  const parsed = schema.safeParse({ slug });
  if (!parsed.success) return json(400, { ok:false, error:'Bad query', details: parsed.error.flatten() });

  const token = verifyTokenFromHeaders(event.headers || {});
  const isSubscribed = !!token?.subscribed;

  const rows = await sql`
    SELECT id, slug, title, summary_public,
           CASE WHEN ${isSubscribed} THEN summary_premium ELSE '' END as summary_premium,
           CASE WHEN ${qLike} IS NOT NULL AND summary_premium ILIKE ${qLike} THEN TRUE ELSE FALSE END as premium_match,
           source_url, source_label, doc_date, tags, created_at
    FROM documents
    WHERE slug = ${parsed.data.slug}
    LIMIT 1
  `;
  if (!rows?.length) return json(404, { ok:false, error:'Not found' });

  return json(200, { ok:true, data: rows[0], auth: { subscribed: isSubscribed } });
};
