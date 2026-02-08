import { preflight, json } from './_cors.mjs';
import { getSql } from './_db.mjs';
import { verifyTokenFromHeaders } from './_auth.mjs';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).max(1000).default(1),
});

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'GET only' });

  const sql = getSql();
  if (!sql) return json(500, { ok:false, error:'NEON_DATABASE_URL missing' });

  const parsed = querySchema.safeParse(event.queryStringParameters || {});
  if (!parsed.success) return json(400, { ok:false, error:'Bad query', details: parsed.error.flatten() });

  const { q, tag, limit, page } = parsed.data;
  const qLike = q ? ('%' + q + '%') : null;
  const offset = (page - 1) * limit;

  const token = verifyTokenFromHeaders(event.headers || {});
  const email = token?.email || null;
  const isSubscribed = !!token?.subscribed;

  await sql`INSERT INTO api_usage (endpoint, email) VALUES ('documents', ${email})`;

  let where = sql`TRUE`;
  if (q) where = sql`${where} AND (title ILIKE ${'%' + q + '%'} OR summary_public ILIKE ${'%' + q + '%'} )`;
  if (tag) where = sql`${where} AND ${tag} = ANY(tags)`;

  const rows = await sql`
    SELECT id, slug, title, summary_public,
           ${isSubscribed} as premium_enabled,
           CASE WHEN ${isSubscribed} THEN summary_premium ELSE '' END as summary_premium,
           CASE WHEN ${qLike} IS NOT NULL AND summary_premium ILIKE ${qLike} THEN TRUE ELSE FALSE END as premium_match,
           source_url, source_label, doc_date, tags, created_at
    FROM documents
    WHERE ${where}
    ORDER BY doc_date DESC NULLS LAST, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`SELECT COUNT(*)::int as c FROM documents WHERE ${where}`;
  const total = countRows?.[0]?.c ?? 0;

  return json(200, {
    ok: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    auth: { subscribed: isSubscribed }
  });
};
