import type { AppKey } from "@astro/copy";
import { lazy, Suspense, useEffect, useRef } from "react";
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, useLocation, useMatches, useNavigate } from "react-router";
import { PreviewBar } from "@/components/PreviewBar";
import { Failed, Main, ProgressLine, RouteLoading } from "./data";
import { busy } from "./busy";
import { interceptLinks, setNavigator } from "./nav";
import Maintenance from "./routes/Maintenance";
import { ApiError } from "./api";
import { useSession, type SessionUser } from "./session";
import { AppShell, type ShellTab } from "./shell/AppShell";

// Each screen is its own file, loaded when first opened; the draw screens bring the animation library with them.
const Account = lazy(() => import("./routes/Account"));
const Ask = lazy(() => import("./routes/Ask"));
const CheckIn = lazy(() => import("./routes/CheckIn"));
const DrawOne = lazy(() => import("./routes/DrawOne"));
const DrawThree = lazy(() => import("./routes/DrawThree"));
const Journal = lazy(() => import("./routes/Journal"));
const Legal = lazy(() => import("./routes/Legal"));
const Patterns = lazy(() => import("./routes/Patterns"));
const Reading = lazy(() => import("./routes/Reading"));
const Today = lazy(() => import("./routes/Today"));
const Verify = lazy(() => import("./routes/Verify"));
const Desk = lazy(() => import("./routes/Desk"));
const Log = lazy(() => import("./routes/Log"));
const LogEntry = lazy(() => import("./routes/LogEntry"));
const Invite = lazy(() => import("./routes/Invite"));
const Offer = lazy(() => import("./routes/Offer"));
const SignInPage = lazy(() => import("./routes/Auth").then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import("./routes/Auth").then((m) => ({ default: m.SignUpPage })));
const ForgotPage = lazy(() => import("./routes/Auth").then((m) => ({ default: m.ForgotPage })));
const ResetPage = lazy(() => import("./routes/Auth").then((m) => ({ default: m.ResetPage })));
const TwoStepPage = lazy(() => import("./routes/Auth").then((m) => ({ default: m.TwoStepPage })));

/**
 * What the frame needs to know about a screen: which tab it belongs to, and for deeper screens where back goes
 * (when there's no earlier screen in the app to return to) and the name shown in the phone top bar.
 */
interface Screen {
  tab?: ShellTab | ((user: SessionUser | null) => ShellTab);
  back?: (params: Record<string, string | undefined>) => string;
  title?: AppKey;
}

/** The screen's frame. Opening a screen keeps it in place, so the menu, tabs and top bar never disappear. */
function ShellLayout() {
  const { t, user } = useSession();
  const matches = useMatches();
  const match = matches[matches.length - 1];
  const screen = (match?.handle ?? {}) as Screen;
  const tab = typeof screen.tab === "function" ? screen.tab(user) : screen.tab;
  return (
    <AppShell current={tab} back={screen.back?.(match?.params ?? {})} title={screen.title ? t(screen.title) : undefined}>
      <Main>
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </Main>
    </AppShell>
  );
}

/** Screens without the app frame: sign-in and its friends, and the maintenance notice. */
function BareLayout() {
  return (
    <Main>
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </Main>
  );
}

/** Around every screen: skip link, progress line, preview bar, maintenance gate, in-app links, focus and scroll. */
function Frame() {
  const { t, preview, maintenance } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  // A move counts as loading until the new screen is on screen: React keeps the old one up while the next one's
  // code downloads, and the progress line shows that wait.
  const moving = useRef<(() => void) | null>(null);
  useEffect(() => {
    moving.current?.();
    moving.current = null;
  }, [location.key]);
  useEffect(() => {
    setNavigator((to, { replace }) => {
      moving.current?.();
      moving.current = busy.start();
      void navigate(to, { replace });
    });
    const stop = interceptLinks(document);
    return () => {
      stop();
      setNavigator(null);
    };
  }, [navigate]);

  // After moving to another screen, screen readers and keyboards start at its content, as after a page load.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  const paused = maintenance.on && location.pathname !== "/maintenance";
  return (
    <>
      <a href="#main" className="skip-link">
        {t("app.layout.skip")}
      </a>
      <ProgressLine />
      {preview ? <PreviewBar /> : null}
      {paused ? (
        <Main>
          <Maintenance />
        </Main>
      ) : (
        <Outlet />
      )}
      <ScrollRestoration />
    </>
  );
}

const reading = (p: Record<string, string | undefined>) => `/reading/${encodeURIComponent(p.id ?? "")}`;

export const router = createBrowserRouter([
  {
    element: <Frame />,
    children: [
      {
        element: <ShellLayout />,
        children: [
          { path: "/", element: <Navigate to="/today" replace /> },
          { path: "/today", element: <Today />, handle: { tab: "today" } satisfies Screen },
          { path: "/ask", element: <Ask />, handle: { tab: "ask" } satisfies Screen },
          { path: "/draw/one", element: <DrawOne />, handle: { tab: "today", back: () => "/today", title: "app.draw.one_meta" } satisfies Screen },
          { path: "/draw/three", element: <DrawThree />, handle: { tab: "today", back: () => "/today", title: "app.draw.three_meta" } satisfies Screen },
          { path: "/reading/:id", element: <Reading />, handle: { tab: "today", back: () => "/today", title: "app.reading.meta" } satisfies Screen },
          { path: "/reading/:id/verify", element: <Verify />, handle: { tab: (u) => (u ? "journal" : "today"), back: reading, title: "app.verify.meta" } satisfies Screen },
          { path: "/journal", element: <Journal />, handle: { tab: "journal" } satisfies Screen },
          { path: "/journal/patterns", element: <Patterns />, handle: { tab: "patterns" } satisfies Screen },
          { path: "/account", element: <Account />, handle: { tab: "account" } satisfies Screen },
          { path: "/check-in/:id", element: <CheckIn />, handle: { tab: "today", back: () => "/today", title: "app.check_in.meta" } satisfies Screen },
          { path: "/terms", element: <Legal page="terms" />, handle: { back: () => "/today", title: "app.legal.terms_meta" } satisfies Screen },
          { path: "/privacy", element: <Legal page="privacy" />, handle: { back: () => "/today", title: "app.legal.privacy_meta" } satisfies Screen },
          { path: "/reader-guidelines", element: <Legal page="guidelines" />, handle: { back: () => "/today", title: "app.legal.guidelines_meta" } satisfies Screen },
          { path: "/desk", element: <Desk />, handle: { tab: "desk" } satisfies Screen },
          { path: "/desk/log", element: <Log />, handle: { tab: "desk", back: () => "/desk", title: "app.log.meta" } satisfies Screen },
          { path: "/desk/log/new", element: <LogEntry />, handle: { tab: "desk", back: () => "/desk/log", title: "app.log.new_title" } satisfies Screen },
          { path: "/desk/log/:id", element: <LogEntry />, handle: { tab: "desk", back: () => "/desk/log", title: "app.log.edit_title" } satisfies Screen },
          { path: "/invite", element: <Invite /> },
          { path: "/offer", element: <Offer /> },
          { path: "*", element: <Failed error={new ApiError(404, "not_found")} /> }
        ]
      },
      {
        element: <BareLayout />,
        children: [
          { path: "/maintenance", element: <Maintenance /> },
          { path: "/sign-in", element: <SignInPage /> },
          { path: "/sign-up", element: <SignUpPage /> },
          { path: "/forgot-password", element: <ForgotPage /> },
          { path: "/reset-password", element: <ResetPage /> },
          { path: "/two-step", element: <TwoStepPage /> }
        ]
      }
    ]
  }
]);
