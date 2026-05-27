export type Color = 'orange' | 'blue' | 'gold' | 'green';

export type Scores = Record<Color, number>;

export type Cluster = {
  color: Color;
  words: [string, string, string];
};

export type Row = [Cluster, Cluster, Cluster, Cluster];

// In-progress responses: 6 rows, each row is 4 ranks (or nulls), one per cluster index.
// A complete row is a permutation of [1,2,3,4]. 4 = most like me, 1 = least.
export type Responses = Array<Array<number | null>>;

export type CandidateRow = {
  token: string;
  zoho_module: string;
  zoho_record_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  responses: Responses;
  scores: Scores | null;
  is_complete: boolean;
  started_at: string | null;
  completed_at: string | null;
  zoho_synced_at: string | null;
  zoho_sync_error: string | null;
  created_at: string;
  updated_at: string;
};
