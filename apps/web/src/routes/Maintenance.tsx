import { useSession, useTitle } from "../session";

// Ported from apps/app/app/maintenance/page.tsx: the owner's notice, live from the session.
export default function MaintenancePage() {
  const { t, maintenance } = useSession();
  useTitle(t("app.maintenance.meta"));
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="m-0 font-display text-3xl font-medium">{maintenance.on ? maintenance.title : t("app.maintenance.title")}</h1>
      <p className="m-0 text-sm text-haze leading-relaxed">{maintenance.on ? maintenance.body : t("app.maintenance.body")}</p>
    </div>
  );
}
