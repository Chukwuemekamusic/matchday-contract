import { OG_COLORS } from "./card";

/**
 * App icon: a football on a green field. The ball stays inside the central 80% so the
 * same image works as a maskable icon (Android crops to a circle or squircle).
 */
export function BallMark({ size, ballRatio = 0.62 }: { size: number; ballRatio?: number }) {
  const ball = Math.round(size * ballRatio);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f8a4a",
      }}
    >
      <svg width={ball} height={ball} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" fill="#ffffff" stroke={OG_COLORS.background} strokeWidth="4" />
        <polygon points="50,30 69,44 62,66 38,66 31,44" fill={OG_COLORS.background} />
        <path
          d="M50 30 L50 5 M69 44 L92 36 M62 66 L76 87 M38 66 L24 87 M31 44 L8 36"
          stroke={OG_COLORS.background}
          strokeWidth="4"
          fill="none"
        />
      </svg>
    </div>
  );
}
