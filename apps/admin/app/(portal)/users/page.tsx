import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { UsersClient } from "@/components/users/UsersClient";
import { pageStaff } from "@/lib/page";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const staff = await pageStaff("users.help");
  if (!staff) return <NoAccess />;
  return (
    <>
      <PageHeader title="Users" lede="Find someone by their exact email to help them. There's no list to browse." />
      <UsersClient />
    </>
  );
}
