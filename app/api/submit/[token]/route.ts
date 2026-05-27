import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { calculateScores, isComplete, isValidShape, primaryColor } from '@/lib/scoring';
import {
  CONTACTS_HUB_MODULE,
  DEAL_MODULE,
  OPPORTUNITY_OWNER,
  fetchContactsHub,
  writeResults,
} from '@/lib/zoho';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: { token: string } },
) {
  const { token } = ctx.params;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !('responses' in body)) {
    return NextResponse.json({ error: 'Missing responses' }, { status: 400 });
  }
  const responses = (body as { responses: unknown }).responses;
  if (!isValidShape(responses) || !isComplete(responses)) {
    return NextResponse.json({ error: 'Responses are not complete' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: row, error: lookupErr } = await supabase
    .from('assessment_progress')
    .select('token, zoho_record_id, is_complete')
    .eq('token', token)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  const scores = calculateScores(responses);
  const primary = primaryColor(scores);
  const completedAt = new Date().toISOString();

  // Idempotent re-submit: if already complete, just hand back the scores.
  if (row.is_complete) {
    return NextResponse.json({ ok: true, scores, primary });
  }

  // Re-fetch the Contacts_Hub record so Relationship + Deal are current,
  // not whatever they were when the token was minted.
  let candidate;
  try {
    candidate = await fetchContactsHub(row.zoho_record_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('assessment_progress')
      .update({ zoho_sync_error: message, responses })
      .eq('token', token);
    return NextResponse.json({ error: `Zoho lookup failed: ${message}` }, { status: 502 });
  }

  // Write to Contacts_Hub first (the candidate's own record).
  try {
    await writeResults(CONTACTS_HUB_MODULE, row.zoho_record_id, scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('assessment_progress')
      .update({ zoho_sync_error: message, responses })
      .eq('token', token);
    return NextResponse.json({ error: `Zoho sync failed: ${message}` }, { status: 502 });
  }

  // Conditional dual-write: mirror scores to the linked Deal if this candidate
  // is the Opportunity Owner and the Deal lookup is populated.
  const shouldWriteDeal =
    candidate.relationship === OPPORTUNITY_OWNER &&
    typeof candidate.dealId === 'string' &&
    candidate.dealId.length > 0;

  if (shouldWriteDeal && candidate.dealId) {
    try {
      await writeResults(DEAL_MODULE, candidate.dealId, scores);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Contacts_Hub already accepted; record the failure and bail so the
      // candidate can retry. A retry will re-write Contacts_Hub harmlessly.
      await supabase
        .from('assessment_progress')
        .update({ zoho_sync_error: `Deal write failed: ${message}`, responses })
        .eq('token', token);
      return NextResponse.json(
        { error: `Deal sync failed: ${message}` },
        { status: 502 },
      );
    }
  }

  const { error: updateErr } = await supabase
    .from('assessment_progress')
    .update({
      responses,
      scores,
      is_complete: true,
      completed_at: completedAt,
      zoho_synced_at: completedAt,
      zoho_sync_error: null,
    })
    .eq('token', token);

  if (updateErr) {
    // Zoho already accepted; surface the DB error but let the client treat as success.
    return NextResponse.json({ ok: true, scores, primary, warning: updateErr.message });
  }

  return NextResponse.json({ ok: true, scores, primary });
}
