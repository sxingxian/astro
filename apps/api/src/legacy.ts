/**
 * Reader-only pages not yet rebuilt (free-plan Stage 2): Desk, My log, invitations, role offers, reader guidelines,
 * their APIs, and the old app's own static files. They are passed unchanged to the old Next.js Worker through the
 * `LEGACY` service binding.
 */
const LEGACY = [/^\/desk(\/|$)/, /^\/invite\/?$/, /^\/offer\/?$/, /^\/reader-guidelines\/?$/, /^\/_next\//, /^\/api\/reader\//, /^\/api\/invite\//, /^\/api\/offer\//];

export const isLegacy = (path: string) => LEGACY.some((re) => re.test(path));

/** The same patterns for wrangler's `run_worker_first`, so these paths reach the Worker instead of the page files. */
export const LEGACY_ROUTES = ["/desk", "/desk/*", "/invite", "/offer", "/reader-guidelines", "/_next/*", "/api/reader/*", "/api/invite/*", "/api/offer/*"];
