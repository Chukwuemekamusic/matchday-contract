/** Deterministic colours for generated avatars, so a person looks the same everywhere */
export function avatarColors(seed: string): [string, string] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const hue = Math.abs(h) % 360;
  return [`hsl(${hue} 65% 45%)`, `hsl(${(hue + 50) % 360} 70% 35%)`];
}

/** Up to two initials from a display name or address */
export function initials(name: string): string {
  if (/^0x[0-9a-f]+/i.test(name)) return name.slice(2, 4).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
