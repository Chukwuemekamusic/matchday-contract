import Link from "next/link";
import { currentProfile } from "@/lib/auth/server";
import { AccountMenuButton } from "./AccountMenuButton";

/** Header account control: sign-in link or the signed-in user's menu */
export async function AccountMenu() {
  const profile = await currentProfile();
  if (!profile) {
    return (
      <Link href="/signin" className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background hover:opacity-90">
        Sign in
      </Link>
    );
  }
  return <AccountMenuButton profile={profile} />;
}
