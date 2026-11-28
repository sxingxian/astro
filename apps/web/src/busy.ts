/** How many screen loads are under way (data or a screen's code), for the progress line at the top. */
let count = 0;
const listeners = new Set<() => void>();

function set(next: number) {
  const was = count > 0;
  count = next;
  if (was !== count > 0) for (const l of listeners) l();
}

export const busy = {
  get: () => count > 0,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** Marks a load as started; call the returned function once it ends (extra calls do nothing). */
  start() {
    set(count + 1);
    let open = true;
    return () => {
      if (!open) return;
      open = false;
      set(count - 1);
    };
  },
  /** Counts a promise until it settles, and hands it back unchanged. */
  track<T>(p: Promise<T>): Promise<T> {
    const done = busy.start();
    return p.finally(done);
  }
};
