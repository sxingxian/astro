/**
 * Moving between screens without reloading the page (Stage 2 design: the frame and the session stay in memory, so
 * the screen never goes blank). Anything this app doesn't draw itself still goes through the browser.
 */

// Screens drawn by this app and safe to open in place. Sign-in screens are left out on purpose: they change who is
// signed in, so they always load fresh. A path missing here just falls back to a normal page load.
const IN_APP: readonly RegExp[] = [
  /^\/$/,
  /^\/today$/,
  /^\/ask$/,
  /^\/draw\/(one|three)$/,
  /^\/reading\/[^/]+(\/verify)?$/,
  /^\/journal(\/patterns)?$/,
  /^\/account$/,
  /^\/check-in\/[^/]+$/,
  /^\/(terms|privacy|reader-guidelines)$/,
  /^\/desk(\/log(\/[^/]+)?)?$/,
  /^\/(invite|offer)$/
];

/**
 * The path to open in place, or null when the browser should handle the link. `here` (path and search of the screen
 * now open) lets a jump to an anchor on the same screen stay with the browser.
 */
export function appPath(href: string, origin: string, here?: string): string | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!IN_APP.some((re) => re.test(url.pathname))) return null;
  if (url.hash && here === `${url.pathname}${url.search}`) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** A plain left click on a link that opens in this tab. */
export function shouldHandle(e: ClickLike, a: { target: string; hasAttribute(name: string): boolean }): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  return !a.hasAttribute("download");
}

type Navigator = (to: string, opts: { replace: boolean }) => void;
let navigator: Navigator | null = null;

/** Set by the app frame once the router is running. */
export function setNavigator(nav: Navigator | null) {
  navigator = nav;
}

/** Go to a screen: in place when the app draws it, otherwise a normal page load. */
export function go(href: string, { replace = false }: { replace?: boolean } = {}) {
  const path = navigator ? appPath(href, window.location.origin) : null;
  if (path && navigator) return navigator(path, { replace });
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}

/** Opens links to this app's screens in place. Returns the function that stops it. */
export function interceptLinks(doc: Document): () => void {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement) || !navigator || !shouldHandle(e, a)) return;
    const path = appPath(a.href, window.location.origin, `${window.location.pathname}${window.location.search}`);
    if (!path) return;
    e.preventDefault();
    navigator(path, { replace: false });
  };
  doc.addEventListener("click", onClick);
  return () => doc.removeEventListener("click", onClick);
}
