import type { Metadata } from "next";
import { MyBets } from "@/components/MyBets";

export const metadata: Metadata = { title: "My bets — MatchDay" };

export default function MyBetsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My bets</h1>
      <MyBets />
    </div>
  );
}
