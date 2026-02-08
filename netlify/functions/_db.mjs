import { neon } from '@neondatabase/serverless';

export function getSql() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
