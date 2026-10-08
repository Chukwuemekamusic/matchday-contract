"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { groupByCode, groupById } from "@/lib/db/groups";
import { newInviteCode, normaliseInviteCode } from "@/lib/inviteCode";

const MAX_OWNED_GROUPS = 20;
const MAX_MEMBERS = 500;

export type GroupFormState = { error?: string };

export async function createGroup(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/groups");
  const name = z.string().trim().min(2, "Name: at least 2 characters").max(40, "Name: up to 40 characters").safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const { count } = await db().from("groups").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  if ((count ?? 0) >= MAX_OWNED_GROUPS) return { error: `You can create up to ${MAX_OWNED_GROUPS} groups.` };

  // Retry on the (unlikely) invite code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db()
      .from("groups")
      .insert({ name: name.data, invite_code: newInviteCode(), owner_id: userId })
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    if (error || !data) return { error: "Could not create the group" };
    await db().from("group_members").insert({ group_id: data.id, user_id: userId });
    redirect(`/groups/${data.id}`);
  }
  return { error: "Could not create the group, please try again" };
}

export async function joinGroup(formData: FormData) {
  const code = normaliseInviteCode(String(formData.get("code") ?? ""));
  if (!code) redirect("/groups");
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?next=/join/${code}`);
  const group = await groupByCode(code);
  if (!group) redirect("/groups");

  const { count } = await db().from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", group.id);
  if ((count ?? 0) >= MAX_MEMBERS) redirect(`/join/${code}?full=1`);
  await db().from("group_members").upsert({ group_id: group.id, user_id: userId }, { onConflict: "group_id,user_id" });
  redirect(`/groups/${group.id}`);
}

export async function leaveGroup(formData: FormData) {
  const userId = await currentUserId();
  const group = await groupById(String(formData.get("groupId") ?? ""));
  if (!userId || !group) redirect("/groups");
  if (group.owner_id === userId) {
    // The owner leaving deletes the group (members' picks and points are unaffected)
    await db().from("groups").delete().eq("id", group.id).eq("owner_id", userId);
  } else {
    await db().from("group_members").delete().eq("group_id", group.id).eq("user_id", userId);
  }
  redirect("/groups");
}
