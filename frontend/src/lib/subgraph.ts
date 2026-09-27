const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "https://api.studio.thegraph.com/query/122239/matchdaybet-v-2/version/latest";

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

export async function fetchUserBets(address: string): Promise<{ user: SubgraphUser | null; bets: SubgraphBet[] }> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: USER_BETS, variables: { user: address.toLowerCase() } }),
  });
  if (!res.ok) throw new Error(`Subgraph request failed (${res.status})`);
  const json = (await res.json()) as { data?: { user: SubgraphUser | null; bets: SubgraphBet[] }; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data ?? { user: null, bets: [] };
}
