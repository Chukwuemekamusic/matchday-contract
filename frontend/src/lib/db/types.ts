export interface FixtureRow {
  id: number;
  competition_code: string;
  competition_name: string;
  competition_emblem: string | null;
  home_team: string;
  home_short: string | null;
  home_crest: string | null;
  away_team: string;
  away_short: string | null;
  away_crest: string | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  updated_at: string;
}

export type OnChainState = "creating" | "open" | "resolved" | "cancelled" | "failed";

export interface OnChainMatchRow {
  id: number;
  fixture_id: number;
  match_id: number | null;
  /** Kickoff passed to createMatch; betting closes at this time on-chain */
  kickoff_at: string;
  state: OnChainState;
  create_tx_hash: string | null;
  result: number | null;
  settle_tx_hash: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Fixture plus its current on-chain match id (if any), as sent to the browser */
export interface FixtureView extends FixtureRow {
  onchain_match_id: number | null;
}
