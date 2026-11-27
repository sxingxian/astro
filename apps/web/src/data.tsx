import { useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "./api";
import { useSession } from "./session";

type State<T> = { data: T; error: null } | { data: null; error: ApiError | null };

/** A screen's data from the data Worker. Signed out → sign-in; paused → the maintenance notice. */
export function useData<T>(path: string | null): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path).then(
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
  }, [path]);
  return state;
}

/** While a screen's data loads: the page frame with a quiet placeholder (screen readers hear "Loading"). */
export function Loading() {
  return (
    <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pb-32 pt-8 lg:max-w-none lg:px-0" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="panel h-24 animate-pulse opacity-60" />
      <div className="panel h-40 animate-pulse opacity-40" />
    </div>
  );
}

/** A screen that couldn't load: not found, or something went wrong (with a retry). */
export function Failed({ error }: { error: ApiError | null }) {
  const { t } = useSession();
  const missing = error?.status === 404;
  return (
    <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pb-32 pt-10">
      <h1 className="m-0 font-display text-3xl font-medium">{missing ? t("app.errors.not_found_title") : t("app.errors.generic_title")}</h1>
      <p className="m-0 text-haze">{missing ? t("app.errors.not_found_body") : t("app.errors.generic_body")}</p>
      <a className="btn-gold min-h-11 self-start px-6" href={missing ? "/today" : ""} onClick={missing ? undefined : (e) => (e.preventDefault(), window.location.reload())}>
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
