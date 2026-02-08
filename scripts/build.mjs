import fs from 'node:fs';

const mustExist = [
  'site/index.html',
  'site/archive/index.html',
  'site/subscribe/index.html',
  'site/legal/impressum/index.html',
  'site/legal/datenschutz/index.html',
  'site/legal/agb/index.html',
  'netlify/functions/documents.mjs',
  'netlify/functions/document.mjs',
  'netlify/functions/create-checkout.mjs',
  'netlify/functions/verify-session.mjs',
  'netlify/functions/stripe-webhook.mjs'
];

let ok = true;
for (const p of mustExist) {
  if (!fs.existsSync(p)) {
    console.error('Missing:', p);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('✅ Static site ready. Functions present.');
