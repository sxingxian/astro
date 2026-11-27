import { canGrant, canOfferReader, canRemoveReader, type Role } from "@astro/server";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { TeamClient } from "@/components/team/TeamClient";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";
import { mayOffer } from "@/lib/readers";
import { listTeam } from "@/lib/team";

export const metadata = { title: "Team and roles" };
export const dynamic = "force-dynamic";

const GRANTABLE: Role[] = ["admin", "moderator", "reader"];

export default async function TeamPage() {
  const staff = await pageStaff("team.invite");
  if (!staff) return <NoAccess />;
  const team = await listTeam(getDb(), new Date());
  const staffIds = new Set(team.members.filter((m) => m.role).map((m) => m.userId));
  return (
    <>
      <PageHeader title="Team and roles" lede="Invite someone new, or offer a role to an account that already exists. Nobody gets a role until they accept it. A person can be a reader only, hold one portal role, or both." />
      <TeamClient
        me={{ id: staff.id, role: staff.role }}
        grantable={GRANTABLE.filter((r) => canGrant(staff.role, r))}
        offerable={(["moderator", "admin"] as const).filter((r) => canGrant(staff.role, r))}
        members={team.members.map((m) => {
          const self = m.userId === staff.id;
          const isStaff = m.role !== null;
          return {
            ...m,
            grantedAt: m.grantedAt.toISOString(),
            canManage: !self && isStaff && m.role !== "owner" && canGrant(staff.role, m.role!),
            addReader: m.reader || !isStaff || staff.role !== "owner" ? null : self ? ("self" as const) : ("offer" as const),
            canRemoveReader: m.reader && canRemoveReader(staff.role, isStaff, self),
            canOfferAgain: m.formerReader && canOfferReader(staff.role, false)
          };
        })}
        invites={team.invites.filter((i) => i.status === "pending").map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(), canCancel: canGrant(staff.role, i.role) }))}
        offers={team.offers.map((o) => ({ ...o, expiresAt: o.expiresAt.toISOString(), canWithdraw: mayOffer(staff, staffIds.has(o.userId), o) }))}
      />
    </>
  );
}
