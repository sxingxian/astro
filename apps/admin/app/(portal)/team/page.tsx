import { canGrant, type Role } from "@astro/server";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { TeamClient } from "@/components/team/TeamClient";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";
import { listTeam } from "@/lib/team";

export const metadata = { title: "Team and roles" };
export const dynamic = "force-dynamic";

const GRANTABLE: Role[] = ["admin", "moderator", "reader"];

export default async function TeamPage() {
  const staff = await pageStaff("team.invite");
  if (!staff) return <NoAccess />;
  const team = await listTeam(getDb(), new Date());
  return (
    <>
      <PageHeader title="Team and roles" lede="People join only by invitation. Signing up on the app never gives anyone a role." />
      <TeamClient
        me={{ id: staff.id, role: staff.role }}
        grantable={GRANTABLE.filter((r) => canGrant(staff.role, r))}
        members={team.members.map((m) => ({ ...m, grantedAt: m.grantedAt.toISOString(), canManage: m.userId !== staff.id && m.role !== "owner" && canGrant(staff.role, m.role) }))}
        invites={team.invites.filter((i) => i.status === "pending").map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(), canCancel: canGrant(staff.role, i.role) }))}
      />
    </>
  );
}
