import { Sidebar } from "@/components/Sidebar";

// Part of A4 replaces this with the signed-in person's role-filtered menu.
const ITEMS = [{ href: "/", label: "Dashboard" }];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-wrap">
      <Sidebar items={ITEMS} current="/" email="" role="" />
      <div className="flex-[999_1_560px] min-w-0 flex flex-col">
        <main id="main" tabIndex={-1} className="px-8 py-7 flex flex-col gap-5 outline-none">{children}</main>
      </div>
    </div>
  );
}
