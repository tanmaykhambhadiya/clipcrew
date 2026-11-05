import Link from "next/link";
import { can, getMe } from "@/lib/portal/session";

export default async function AdminHome() {
  const me = (await getMe())!; // the layout already redirects signed-out users
  return (
    <div>
      <p className="eyebrow text-lime">{"//"} Overview</p>
      <h1 className="mt-3 text-[40px] leading-[1.02] md:text-[56px]">
        <span className="block font-display font-bold uppercase">Welcome back,</span>
        <span className="block font-serif italic text-lime">{me.fullName.split(" ")[0]}.</span>
      </h1>
      <p className="mt-6 max-w-xl text-muted-dark md:text-lg">
        Campaigns, weekly views, rejections and payouts are coming next. For now you can create and manage logins.
      </p>
      {can(me, "users.create") && (
        <Link href="/admin/users" className="mt-8 inline-block rounded-full bg-lime px-7 py-3.5 font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-lime">
          Manage users
        </Link>
      )}
    </div>
  );
}
