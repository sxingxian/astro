/**
 * Go to another screen after an action. A normal page load here; the pre-built app (apps/web) swaps this file for
 * one that opens its own screens in place.
 */
export function go(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}
