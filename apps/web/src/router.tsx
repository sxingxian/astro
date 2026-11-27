import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { PreviewBar } from "@/components/PreviewBar";
import { Failed, Loading, Main } from "./data";
import { ForgotPage, ResetPage, SignInPage, SignUpPage, TwoStepPage } from "./routes/Auth";
import Maintenance from "./routes/Maintenance";
import { ApiError } from "./api";
import { useSession } from "./session";

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

/** The page frame from the Next.js layout: skip link, preview bar, main landmark. Paused → the notice everywhere. */
function Frame() {
  const { t, preview, maintenance } = useSession();
  const paused = maintenance.on && window.location.pathname !== "/maintenance";
  return (
    <>
      <a href="#main" className="skip-link">
        {t("app.layout.skip")}
      </a>
      {preview ? <PreviewBar /> : null}
      <Main>
        <Suspense fallback={<Loading />}>{paused ? <Maintenance /> : <Outlet />}</Suspense>
      </Main>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Frame />,
    children: [
      { path: "/", element: <Navigate to="/today" replace /> },
      { path: "/today", element: <Today /> },
      { path: "/ask", element: <Ask /> },
      { path: "/draw/one", element: <DrawOne /> },
      { path: "/draw/three", element: <DrawThree /> },
      { path: "/reading/:id", element: <Reading /> },
      { path: "/reading/:id/verify", element: <Verify /> },
      { path: "/journal", element: <Journal /> },
      { path: "/journal/patterns", element: <Patterns /> },
      { path: "/account", element: <Account /> },
      { path: "/check-in/:id", element: <CheckIn /> },
      { path: "/terms", element: <Legal page="terms" /> },
      { path: "/privacy", element: <Legal page="privacy" /> },
      { path: "/maintenance", element: <Maintenance /> },
      { path: "/sign-in", element: <SignInPage /> },
      { path: "/sign-up", element: <SignUpPage /> },
      { path: "/forgot-password", element: <ForgotPage /> },
      { path: "/reset-password", element: <ResetPage /> },
      { path: "/two-step", element: <TwoStepPage /> },
      { path: "*", element: <Failed error={new ApiError(404, "not_found")} /> }
    ]
  }
]);
