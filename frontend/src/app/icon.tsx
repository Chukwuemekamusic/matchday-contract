import { ImageResponse } from "next/og";
import { BallMark } from "@/lib/og/BallMark";

const SIZES = { "32": 32, "192": 192, "512": 512 } as const;

export function generateImageMetadata() {
  return Object.entries(SIZES).map(([id, px]) => ({ id, size: { width: px, height: px }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const px = SIZES[String(await id) as keyof typeof SIZES] ?? 192;
  // The tiny favicon gets a bigger ball so it reads at tab size
  return new ImageResponse(<BallMark size={px} ballRatio={px <= 32 ? 0.84 : 0.62} />, { width: px, height: px });
}
