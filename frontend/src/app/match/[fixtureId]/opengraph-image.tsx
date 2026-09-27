import { ImageResponse } from "next/og";
import { matchDayBet } from "@/lib/contract/config";
import { getFixture } from "@/lib/db/queries";
import { formatEth } from "@/lib/format";
import { publicClient } from "@/lib/keeper/chain";
import { OG_COLORS, OG_SIZE, OgFrame } from "@/lib/og/card";

export const alt = "Match on MatchDay";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Crest as a data URL; football-data serves PNG and SVG crests, Satori only renders raster images reliably */
async function crestDataUrl(url: string | null): Promise<string | null> {
  if (!url || !/\.(png|jpe?g)$/i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/") || type.includes("svg")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

async function poolFor(matchId: number | null): Promise<bigint | null> {
  if (matchId === null) return null;
  try {
    const m = await publicClient.readContract({ ...matchDayBet, functionName: "getMatch", args: [BigInt(matchId)] });
    return m.totalPool;
  } catch {
    return null;
  }
}

function Team({ name, crest }: { name: string; crest: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: 400 }}>
      {crest ? (
        <img src={crest} width={150} height={150} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            width: 150,
            height: 150,
            borderRadius: 75,
            background: OG_COLORS.surface,
            border: `2px solid ${OG_COLORS.border}`,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 700,
            color: OG_COLORS.muted,
          }}
        >
          {name.slice(0, 3).toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700, textAlign: "center" }}>{name}</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ fixtureId: string }> }) {
  const id = Number((await params).fixtureId);
  const fixture = Number.isInteger(id) && id > 0 ? await getFixture(id).catch(() => null) : null;

  if (!fixture) {
    return new ImageResponse(
      (
        <OgFrame>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>Match not found</div>
        </OgFrame>
      ),
      size,
    );
  }

  const [homeCrest, awayCrest, pool] = await Promise.all([
    crestDataUrl(fixture.home_crest),
    crestDataUrl(fixture.away_crest),
    poolFor(fixture.onchain_match_id),
  ]);
  const scored = fixture.home_score !== null && fixture.away_score !== null;
  // Viewers are in any time zone, so the image states UTC explicitly
  const kickoff = new Date(fixture.kickoff_at).toLocaleString("en-GB", {
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
            <span>{`${kickoff} UTC`}</span>
            <span style={{ color: OG_COLORS.accent }}>
              {pool && pool > 0n ? `Pool ${formatEth(pool)} ETH` : "Be the first to bet"}
            </span>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 28, color: OG_COLORS.muted, textTransform: "uppercase", letterSpacing: 2 }}>
            {fixture.competition_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <Team name={fixture.home_short ?? fixture.home_team} crest={homeCrest} />
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: OG_COLORS.muted }}>
              {scored ? `${fixture.home_score} – ${fixture.away_score}` : "vs"}
            </div>
            <Team name={fixture.away_short ?? fixture.away_team} crest={awayCrest} />
          </div>
        </div>
      </OgFrame>
    ),
    size,
  );
}
