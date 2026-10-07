import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MatchDay — pool betting on football",
    short_name: "MatchDay",
    description: "Pick home, draw or away. Winners split the pool. Paid in ETH on Base.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d110e",
    theme_color: "#0d110e",
    categories: ["sports", "entertainment"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My bets", url: "/me" },
      { name: "Leaderboard", url: "/leaderboard" },
    ],
  };
}
