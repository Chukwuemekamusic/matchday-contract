import { ImageResponse } from "next/og";
import { BallMark } from "@/lib/og/BallMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BallMark size={180} ballRatio={0.66} />, size);
}
