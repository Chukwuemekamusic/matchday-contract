"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export type ProfileState = { status: "idle" | "saved" | "error"; message?: string };

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _"),
  display_name: z.string().trim().min(1, "Enter a display name").max(30, "Display name: up to 30 characters"),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const userId = await currentUserId();
  if (!userId) return { status: "error", message: "Sign in first" };
  const parsed = profileSchema.safeParse({ username: formData.get("username"), display_name: formData.get("display_name") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  const { error } = await db().from("profiles").update(parsed.data).eq("id", userId);
  if (error) {
    return { status: "error", message: error.code === "23505" ? "That username is taken" : "Could not save" };
  }
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved" };
}

export async function unlinkWallet(formData: FormData) {
  const userId = await currentUserId();
  const address = String(formData.get("address") ?? "").toLowerCase();
  if (!userId || !address) return;
  await db().from("wallets").delete().eq("address", address).eq("user_id", userId);
  revalidatePath("/settings");
}
