import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { emptyResponses, isValidShape } from '@/lib/scoring';
import type { CandidateRow, Responses } from '@/lib/types';
import Assessment from './Assessment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TokenPage({ params }: { params: { token: string } }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('assessment_progress')
    .select('*')
    .eq('token', params.token)
    .maybeSingle();

  if (error) {
    // Surface DB errors as 404 to candidates; logs will have the real error.
    console.error('[token] supabase error', error);
    notFound();
  }
  if (!data) notFound();

  const row = data as CandidateRow;
  const initialResponses: Responses = isValidShape(row.responses) ? row.responses : emptyResponses();

  return (
    <>
      <div className="blobs" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <Assessment
        token={row.token}
        firstName={row.first_name || 'there'}
        initialResponses={initialResponses}
        alreadyComplete={row.is_complete}
        savedPrimary={row.primary_color}
        savedScores={row.scores}
      />
    </>
  );
}
