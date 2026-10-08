/* eslint-disable @next/next/no-img-element -- avatars come from Google/Telegram/ENS hosts */
import { avatarColors, initials } from "@/lib/avatar";

/** Profile photo when available, otherwise initials on a colour derived from `seed` */
export function Avatar({ name, seed, src, size = 28 }: { name: string; seed: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const [a, b] = avatarColors(seed);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </span>
  );
}
