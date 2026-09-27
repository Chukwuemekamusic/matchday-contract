import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_COLORS = {
  background: "#0d110e",
  surface: "#151b17",
  border: "#28322b",
  text: "#e8ede9",
  muted: "#98a59b",
  accent: "#34c07a",
};

/** Shared frame for Open Graph images (Satori: every multi-child div needs display flex) */
export function OgFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG_COLORS.background,
        color: OG_COLORS.text,
        padding: "56px 64px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
        <div
          style={{
            display: "flex",
            width: 52,
            height: 52,
            borderRadius: 26,
            background: OG_COLORS.accent,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 800,
            color: OG_COLORS.background,
          }}
        >
          M
        </div>
        MatchDay
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: OG_COLORS.muted }}>
        {footer ?? <span>Pool betting on football · paid in ETH on Base</span>}
      </div>
    </div>
  );
}
