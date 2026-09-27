const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "https://api.studio.thegraph.com/query/122239/matchdaybet-v-2/v0.3.0";

export interface SubgraphBet {
  id: string;
  amount: string;
  prediction: "HOME" | "DRAW" | "AWAY";
  claimed: boolean;
  placedAt: string;
  match: { matchId: string; homeTeam: string; awayTeam: string; competition: string; kickoffTime: string };
}

export interface SubgraphUser {
  totalBets: string;
  totalWagered: string;
  totalClaimed: string;
  totalProfit: string;
  winCount: string;
  lossCount: string;
  refundCount: string;
}

// Only fields that exist in every deployed schema version; settlement state is read on-chain.
const USER_BETS = /* GraphQL */ `
  query UserBets($user: String!) {
    user(id: $user) {
      totalBets
      totalWagered
      totalClaimed
      totalProfit
      winCount
      lossCount
      refundCount
    }
    bets(where: { bettor: $user }, orderBy: placedAt, orderDirection: desc, first: 500) {
      id
      amount
      prediction
      claimed
      placedAt
      match {
        matchId
        homeTeam
        awayTeam
        competition
        kickoffTime
      }
    }
  }
`;

async function query<T>(query: string, variables: Record<string, unknown>, init?: RequestInit): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    ...init,
  });
  if (!res.ok) throw new Error(`Subgraph request failed (${res.status})`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("Subgraph returned no data");
  return json.data;
}

export async function fetchUserBets(address: string): Promise<{ user: SubgraphUser | null; bets: SubgraphBet[] }> {
  return query(USER_BETS, { user: address.toLowerCase() });
}

export type LeaderboardSort = "profit" | "wins";

export interface LeaderboardEntry extends SubgraphUser {
  id: string;
}

const LEADERBOARD = /* GraphQL */ `
  query Leaderboard($orderBy: User_orderBy!) {
    users(first: 50, orderBy: $orderBy, orderDirection: desc, where: { totalBets_gt: 0 }) {
      id
      totalBets
      totalWagered
      totalClaimed
      totalProfit
      winCount
      lossCount
      refundCount
    }
  }
`;

/** Top bettors; cached for a minute on the server */
export async function fetchLeaderboard(sort: LeaderboardSort): Promise<LeaderboardEntry[]> {
  const data = await query<{ users: LeaderboardEntry[] }>(
    LEADERBOARD,
    { orderBy: sort === "wins" ? "winCount" : "totalProfit" },
    { next: { revalidate: 60 } },
  );
  return data.users;
}
