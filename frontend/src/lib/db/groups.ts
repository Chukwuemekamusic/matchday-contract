import "server-only";
import type { Profile } from "../auth/types";
import { db } from "./client";

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
}

export interface GroupSummary extends Group {
  members: number;
}

export async function groupsOf(userId: string): Promise<GroupSummary[]> {
  const { data, error } = await db()
    .from("group_members")
    .select("groups!inner(id, name, invite_code, owner_id, created_at, group_members(count))")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { groups: Group & { group_members: { count: number }[] } }[]).map(({ groups: g }) => ({
    id: g.id,
    name: g.name,
    invite_code: g.invite_code,
    owner_id: g.owner_id,
    created_at: g.created_at,
    members: g.group_members[0]?.count ?? 0,
  }));
}

export async function groupById(id: string): Promise<Group | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data, error } = await db().from("groups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function groupByCode(code: string): Promise<Group | null> {
  const { data, error } = await db().from("groups").select("*").eq("invite_code", code).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function groupMembers(groupId: string): Promise<(Profile & { joined_at: string })[]> {
  const { data, error } = await db()
    .from("group_members")
    .select("joined_at, profiles!inner(id, username, display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as { joined_at: string; profiles: Profile }[]).map((r) => ({ ...r.profiles, joined_at: r.joined_at }));
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const { count, error } = await db()
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
