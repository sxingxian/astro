// next/navigation for the pre-built pages. Screens this app draws open in place (see ../nav.ts); anything else is a
// normal page load. refresh() reads the open screen's data again in place, as router.refresh() did in Next.js.
import { useLocation, useSearchParams as useRouterSearchParams } from "react-router";
import { refreshData } from "../data";
import { go } from "../nav";

export function useRouter() {
  return {
    push: (href: string) => go(href),
    replace: (href: string) => go(href, { replace: true }),
    refresh: refreshData,
    back: () => window.history.back()
  };
}

export const usePathname = () => useLocation().pathname;
export const useSearchParams = () => useRouterSearchParams()[0];

export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error(`redirecting to ${href}`);
}

export function notFound(): never {
  throw new NotFoundError();
}

export class NotFoundError extends Error {}
