# Deploying the landing page

The landing page (`apps/landing`) is a static Next.js export. A Cloudflare Worker serves it as static assets on `astro.midnightpoetry.studio`.

## One-time setup

1. **Cloudflare API token.** In Cloudflare, go to My Profile → API Tokens and create a token with these permissions:
   - Account → Workers Scripts → Edit
   - Zone → Workers Routes → Edit, for the `midnightpoetry.studio` zone
   - Zone → DNS → Edit, for the `midnightpoetry.studio` zone (needed so the custom domain can be attached)
2. **GitHub secrets.** In the repo, go to Settings → Secrets and variables → Actions and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID`: shown on the right-hand side of the Cloudflare dashboard
3. **GitHub environment.** In Settings → Environments, create `production` and add yourself as a required reviewer. Every deploy then waits for your approval.
4. **Domain.** `apps/landing/wrangler.jsonc` attaches `astro.midnightpoetry.studio` as a custom domain on the first deploy. The zone must already be on Cloudflare.

## How deploys run

- Every pull request runs CI: lint, typecheck, unit tests, build and end-to-end tests.
- When a change merges to `main` and touches `apps/landing`, `packages` or the lockfile, the **Deploy landing** workflow builds the site and runs `wrangler deploy` once you approve it.
- You can also start a deploy by hand from the Actions tab with "Run workflow".

## Check the deployed headers

```bash
curl -sI https://astro.midnightpoetry.studio | grep -iE "content-security-policy|strict-transport|x-content-type|referrer-policy|permissions-policy"
```

The response should include a CSP with `script-src 'self' 'sha256-…'`, plus HSTS, `nosniff` and `frame-ancestors 'none'`.

## Run it locally

```bash
pnpm --filter @astro/landing build
pnpm --filter @astro/landing preview   # wrangler dev, applies _headers like production
```

The admin portal (plan 4) will add its own Worker on the more specific route `astro.midnightpoetry.studio/admin*`. Cloudflare sends `/admin` traffic to that Worker and everything else to this one.
