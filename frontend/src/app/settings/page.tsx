import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { shortAddress } from "@/lib/format";
import { unlinkWallet } from "./actions";
import { LinkWallet } from "./LinkWallet";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Settings — MatchDay" };

export default async function SettingsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/signin?next=/settings");

  const { data: wallets } = await db()
    .from("wallets")
    .select("address, linked_at")
    .eq("user_id", profile.id)
    .order("linked_at", { ascending: true });

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Profile</h2>
        <ProfileForm profile={profile} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 className="font-semibold">Wallets</h2>
          <p className="text-sm text-muted">
            Link a wallet so the picks you back with ETH show on your profile. Linking only asks for a signature — no
            transaction and no gas.
          </p>
        </div>
        {(wallets ?? []).length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(wallets ?? []).map((w) => (
              <li key={w.address} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono">{shortAddress(w.address)}</span>
                <form action={unlinkWallet} className="ml-auto">
                  <input type="hidden" name="address" value={w.address} />
                  <button className="text-xs text-muted hover:text-danger">Unlink</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <LinkWallet userId={profile.id} linked={(wallets ?? []).map((w) => w.address as string)} />
      </section>
    </div>
  );
}
