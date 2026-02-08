# Epstein Files Hub (Netlify + Neon + Stripe) — MVP v2

Static frontend + Netlify Functions. **Stable deploy** (no Next/SSR).

## Netlify
- Build: `npm run build`
- Publish: `site` ✅ (NOT `.next`)
- Functions: `netlify/functions`
- Redirects: `/api/*` -> `/.netlify/functions/*`

## Env vars
See `.env.example`.

## Neon
Run `database/schema.sql`.

## Seed demo docs
POST `/.netlify/functions/seed` with header:
`Authorization: Bearer <ADMIN_SEED_TOKEN>`

## Stripe
Webhook endpoint:
`https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`

Events:
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

## Smart Premium Match (“zufällig genau das”)
When a search query matches premium highlights, the API returns `premium_match: true` for **unsubscribed** users (teaser only, no premium text).
Subscribed users automatically see the premium highlight text.
