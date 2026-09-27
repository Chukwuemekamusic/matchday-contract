import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE, OgFrame } from "@/lib/og/card";

export const alt = "MatchDay — back your team, split the pot";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>Back your team.</div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, color: OG_COLORS.accent }}>Split the pot.</div>
          <div style={{ fontSize: 32, color: OG_COLORS.muted, maxWidth: 900 }}>
            Pick home, draw or away on Europe&apos;s top leagues. Winners share the pool — no bookmaker.
          </div>
        </div>
      </OgFrame>
    ),
    size,
  );
}
