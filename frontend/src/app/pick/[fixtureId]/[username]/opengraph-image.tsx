import { ImageResponse } from "next/og";
import { avatarColors, initials } from "@/lib/avatar";
import { loadPickCard, pickedTeam } from "@/lib/db/pickCard";
import { OG_COLORS, OG_SIZE, OgFrame } from "@/lib/og/card";
import { pickShares, totalPicks } from "@/lib/picks";

export const alt = "A MatchDay pick";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ fixtureId: string; username: string }> }) {
  const { fixtureId, username } = await params;
  const card = await loadPickCard(Number(fixtureId), decodeURIComponent(username)).catch(() => null);

  if (!card) {
    return new ImageResponse(
      (
        <OgFrame>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>Make your pick</div>
        </OgFrame>
      ),
      size,
    );
  }

  const f = card.fixture;
  const [c1, c2] = avatarColors(card.profile.id);
  const total = totalPicks(card.counts);
  const share = pickShares(card.counts)[card.pick.prediction];
  const kickoff = new Date(f.kickoff_at).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return new ImageResponse(
    (
      <OgFrame
        footer={
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <span>{`${f.competition_name} · ${kickoff} UTC`}</span>
            <span style={{ color: OG_COLORS.accent }}>Think they&apos;re wrong? Make your pick</span>
          </div>
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div
            style={{
              display: "flex",
              width: 150,
              height: 150,
              borderRadius: 75,
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {initials(card.profile.display_name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 40, color: OG_COLORS.muted }}>{`${card.profile.display_name} picked`}</div>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: OG_COLORS.accent, letterSpacing: -2 }}>
              {pickedTeam(card)}
            </div>
            <div style={{ display: "flex", fontSize: 36 }}>{`${f.home_team} vs ${f.away_team}`}</div>
            {total > 1 && (
              <div style={{ display: "flex", fontSize: 28, color: OG_COLORS.muted }}>
                {`${share}% of ${total} fans agree`}
              </div>
            )}
          </div>
        </div>
      </OgFrame>
    ),
    size,
  );
}
