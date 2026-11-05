import { redirect } from "next/navigation";
import { can, getMe } from "@/lib/portal/session";
import { UsersManager } from "./UsersManager";

export default async function UsersPage() {
  const me = await getMe();
  if (!me || !can(me, "users.create")) redirect("/admin");
  return <UsersManager isSuper={me.role === "super_admin"} meId={me.id} />;
}
