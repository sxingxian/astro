import { can } from "@astro/server";
import { CardsClient } from "@/components/cards/CardsClient";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";
import { cardScreen } from "@/lib/text";

export const metadata = { title: "Card library" };
export const dynamic = "force-dynamic";

const GROUPS = new Set(["majors", "wands", "cups", "swords", "pentacles"]);

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ card?: string; group?: string }> }) {
  const staff = await pageStaff("meanings.view");
  if (!staff) return <NoAccess />;
  const sp = await searchParams;
  const group = sp.group && GROUPS.has(sp.group) ? sp.group : "majors";
  const first = sp.card ?? (group === "majors" ? "the-fool" : `ace-of-${group}`);
  const screen = await cardScreen(getDb(), first);
  const canEdit = can(staff.role, "meanings.edit") && can(staff.role, "meanings.publish");
  return (
    <>
      <PageHeader title="Card library" badge="Only the owner publishes" lede="The fixed meaning of each card. Admins can view it but not change it." />
      <CardsClient
        key={screen.card.id}
        cards={screen.cards}
        group={screen.cards.find((c) => c.id === screen.card.id)?.group ?? group}
        card={screen.card}
        fields={screen.fields}
        pending={screen.pending}
        live={screen.live}
        history={screen.history}
        canEdit={canEdit}
      />
    </>
  );
}
