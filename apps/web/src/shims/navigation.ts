// next/navigation for the pre-built pages: every link is a full page load (the pages are static files and each
// screen fetches its own data), so router calls become plain browser navigation.
export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    refresh: () => window.location.reload(),
    back: () => window.history.back()
  };
}

export const usePathname = () => window.location.pathname;
export const useSearchParams = () => new URLSearchParams(window.location.search);

export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error(`redirecting to ${href}`);
}

export function notFound(): never {
  throw new NotFoundError();
}

export class NotFoundError extends Error {}
