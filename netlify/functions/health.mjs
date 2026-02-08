import { preflight, json } from './_cors.mjs';

export const handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  return json(200, { ok: true, service: 'epstein-files-hub', time: new Date().toISOString() });
};
