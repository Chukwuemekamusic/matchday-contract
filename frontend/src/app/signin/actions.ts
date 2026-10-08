"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient, requestOrigin, safeNext } from "@/lib/auth/server";

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next") as string | null);
  const origin = await requestOrigin();
  const { data, error } = await (await authClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/signin?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export type EmailState = { status: "idle" | "sent" | "error"; message?: string };

export async function signInWithEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { status: "error", message: "Enter a valid email address." };
  const next = safeNext(formData.get("next") as string | null);
  const origin = await requestOrigin();
  const { error } = await (await authClient()).auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", message: `We sent a sign-in link to ${email.data}. Open it on this device.` };
}

export async function signOut() {
  await (await authClient()).auth.signOut();
  redirect("/");
}
