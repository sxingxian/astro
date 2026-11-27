import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { SessionProvider } from "./session";
import "./styles.css";

/** Before the session loads (or if it can't): the night background and nothing else, so nothing flashes. */
const Blank = () => <div className="min-h-dvh" aria-busy="true" />;
const Offline = () => (
  <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
    <h1 className="m-0 font-display text-3xl font-medium">Astro can’t connect</h1>
    <p className="m-0 text-sm leading-relaxed text-haze">Check your connection, then reload the page.</p>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider fallback={<Blank />} failed={<Offline />}>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>
);
