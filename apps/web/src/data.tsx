import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ApiError, api } from "./api";
import { busy } from "./busy";
import { useSession } from "./session";

type State<T> = { data: T; error: null } | { data: null; error: ApiError | null };

const REFRESH = "astro:refresh";
/**
 * Reads the open screen's data again in place, keeping what is on screen (a message, a ticked box) meanwhile: what
 * router.refresh() did in the Next.js app, e.g. after the reader guidelines change mid-accept.
 */
export const refreshData = () => window.dispatchEvent(new Event(REFRESH));

/**
 * A screen's data from the data Worker. While a new path loads, what was there stays on screen (a filter change
 * doesn't blank the list). Signed out → sign-in; paused → the maintenance notice.
 */
export function useData<T>(path: string | null): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null });
  const [round, setRound] = useState(0);
  useEffect(() => {
    const again = () => setRound((n) => n + 1);
    window.addEventListener(REFRESH, again);
    return () => window.removeEventListener(REFRESH, again);
  }, []);
  useEffect(() => {
    if (!path) return;
    let live = true;
    busy.track(api<T>(path)).then(
      (data) => live && setState({ data, error: null }),
      (e: unknown) => {
        if (!live) return;
        const err = e instanceof ApiError ? e : new ApiError(0, "network");
        if (err.status === 401) window.location.replace("/sign-in");
        else if (err.status === 503) window.location.replace("/maintenance");
        setState({ data: null, error: err });
      }
    );
    return () => {
      live = false;
    };
  }, [path, round]);
  return state;
}

/** True once `ms` have passed, so quick loads never flash a placeholder. */
function useAfter(ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return on;
}

/** While a screen's data loads: nothing for 150 ms, then a quiet placeholder. Screen readers hear "Loading". */
export function Loading() {
  const { t } = useSession();
  const show = useAfter(150);
  return (
    <div data-page className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">{t("app.layout.loading")}</span>
      {show ? (
        <>
          <div className="skeleton h-3 w-36" />
          <div className="skeleton h-9 w-56" />
          <div className="skeleton h-40 rounded-[20px]" />
          <div className="skeleton h-40 rounded-[20px]" />
        </>
      ) : null}
    </div>
  );
}

/** While a screen's own code downloads (first visit to it): counts as loading for the progress line. */
export function RouteLoading() {
  useEffect(() => busy.start(), []);
  return <Loading />;
}

/** A thin gold line at the very top while any screen is loading. */
export function ProgressLine() {
  const on = useSyncExternalStore(busy.subscribe, busy.get, () => false);
  return <div aria-hidden="true" className={`progress-line ${on ? "is-on" : ""}`} />;
}

/** A screen that couldn't load: not found, or something went wrong (with a retry). */
export function Failed({ error }: { error: ApiError | null }) {
  const { t } = useSession();
  const missing = error?.status === 404;
  return (
    <div data-page className="flex flex-col gap-4">
      <h1 className="m-0 font-display text-4xl font-medium">{missing ? t("app.errors.not_found_title") : t("app.errors.generic_title")}</h1>
      <p className="m-0 text-haze">{missing ? t("app.errors.not_found_body") : t("app.errors.generic_body")}</p>
      <a className="btn-gold min-h-12 px-6 max-lg:w-full lg:self-start" href={missing ? "/today" : ""} onClick={missing ? undefined : (e) => (e.preventDefault(), window.location.reload())}>
        {missing ? t("app.errors.back_today") : t("app.errors.retry")}
      </a>
    </div>
  );
}

export const Main = ({ children }: { children: ReactNode }) => (
  <main id="main" tabIndex={-1} className="outline-none">
    {children}
  </main>
);
