import { getCopy } from "@/lib/copy";

export async function generateMetadata() {
  return { title: (await getCopy())("app.maintenance.meta"), robots: { index: false } };
}

/** Where the notice lives for anyone who opens it directly; while paused, every other page answers 503 with it. */
export default async function MaintenancePage() {
  const t = await getCopy();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="m-0 font-display text-3xl font-medium">{t("app.maintenance.title")}</h1>
      <p className="m-0 text-sm text-haze leading-relaxed">{t("app.maintenance.body")}</p>
    </main>
  );
}
