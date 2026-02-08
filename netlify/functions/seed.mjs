import { preflight, json } from './_cors.mjs';
import { getSql } from './_db.mjs';

const demoDocs = [
  {
    slug: 'timeline-key-dates',
    title: 'Zeitlinie: Schlüsselereignisse (Überblick)',
    summary_public: 'Ein Überblick über zentrale, öffentlich dokumentierte Ereignisse. Keine Spekulation, nur Orientierung.',
    summary_premium: 'Premium: Kuratierte Timeline mit Quellen-Links, Kontext-Hinweisen und “Was als Nächstes lesen?”-Pfad.',
    source_url: 'https://en.wikipedia.org/wiki/Jeffrey_Epstein',
    source_label: 'Wikipedia (start point – replace with primary sources)',
    doc_date: '2019-07-06',
    tags: ['timeline','overview']
  },
  {
    slug: 'court-filings-starter-pack',
    title: 'Starter Pack: Court Filings lesen, ohne wahnsinnig zu werden',
    summary_public: 'Kurzguide: docket, exhibit, deposition – und wie du Belege sauber markierst.',
    summary_premium: 'Premium: Checkliste + Beispiel-Workflow, inkl. Entity-Notizen, Evidenz-Markierung und “Fragen, die du an jedes Filing stellen solltest”.',
    source_url: 'https://www.uscourts.gov/',
    source_label: 'US Courts (starting point)',
    doc_date: '2020-01-01',
    tags: ['guide','legal']
  },
  {
    slug: 'how-to-verify-sources',
    title: 'Quellenprüfung: Dokumente vs. Gerüchte – ein Forensik-Framework',
    summary_public: 'Ein Raster, um Primärquellen (Gericht/Behörden) von Sekundärquellen zu trennen.',
    summary_premium: 'Premium: Bewertungsraster + Beispielbewertungen + Confidence-Skala pro Claim + Anti-Halluzinations-Checkliste.',
    source_url: 'https://www.justice.gov/',
    source_label: 'US DOJ (starting point)',
    doc_date: '2021-06-01',
    tags: ['guide','sources']
  }
];

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'POST only' });

  const token = (event.headers?.authorization || '').replace('Bearer','').trim();
  if (!process.env.ADMIN_SEED_TOKEN || token !== process.env.ADMIN_SEED_TOKEN) {
    return json(401, { ok:false, error:'Unauthorized' });
  }

  const sql = getSql();
  if (!sql) return json(500, { ok:false, error:'NEON_DATABASE_URL missing' });

  for (const d of demoDocs) {
    await sql`
      INSERT INTO documents (slug, title, summary_public, summary_premium, source_url, source_label, doc_date, tags)
      VALUES (${d.slug}, ${d.title}, ${d.summary_public}, ${d.summary_premium}, ${d.source_url}, ${d.source_label}, ${d.doc_date}, ${d.tags})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        summary_public = EXCLUDED.summary_public,
        summary_premium = EXCLUDED.summary_premium,
        source_url = EXCLUDED.source_url,
        source_label = EXCLUDED.source_label,
        doc_date = EXCLUDED.doc_date,
        tags = EXCLUDED.tags,
        updated_at = NOW()
    `;
  }

  return json(200, { ok:true, inserted: demoDocs.length });
};
