import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSupabase } from '@/lib/supabase';
import {
  calculateScores,
  isComplete,
  isValidShape,
  primaryColor,
} from '@/lib/scoring';
import {
  CONTACTS_HUB_MODULE,
  DEAL_MODULE,
  OPPORTUNITY_OWNER,
  fetchContactsHub,
  writeAnalysisUrl,
  writeResults,
} from '@/lib/zoho';
import { generateAnalysis } from '@/lib/analysis';
import { renderToBuffer } from '@/lib/pdf';
import { uploadPdf } from '@/lib/storage';
import { createShortLink } from '@/lib/shortener';
import type { Scores } from '@/lib/types';

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

  // Atomic claim — only succeeds when status is currently 'pending'. This is
  // the refresh / double-submit guard: a second concurrent request hits zero
  // rows and falls through to the diagnostic SELECT below.
  const { data: claimed, error: claimErr } = await supabase
    .from('assessment_progress')
    .update({ submission_status: 'scoring' })
    .eq('token', token)
    .eq('submission_status', 'pending')
    .select('zoho_record_id, first_name');

  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    const { data: existing, error: existingErr } = await supabase
      .from('assessment_progress')
      .select('submission_status, is_complete, scores')
      .eq('token', token)
      .maybeSingle();
    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    if (existing.is_complete) {
      const savedScores = (existing.scores as Scores | null) ?? calculateScores(responses);
      return NextResponse.json({
        ok: true,
        scores: savedScores,
        primary: primaryColor(savedScores),
      });
    }
    return NextResponse.json(
      { error: 'Submission already in progress. Please wait a moment.' },
      { status: 409 },
    );
  }

  const row = claimed[0];
  const scores = calculateScores(responses);
  const primary = primaryColor(scores);
  const completedAt = new Date().toISOString();

  // Re-fetch the Contacts_Hub record so Relationship + Deal are current,
  // not whatever they were when the token was minted.
  let candidate;
  try {
    candidate = await fetchContactsHub(row.zoho_record_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await releaseClaim(token, message, responses);
    return NextResponse.json({ error: `Zoho lookup failed: ${message}` }, { status: 502 });
  }

  // Write to Contacts_Hub first (the candidate's own record).
  try {
    await writeResults(CONTACTS_HUB_MODULE, row.zoho_record_id, scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await releaseClaim(token, message, responses);
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
      // Contacts_Hub already accepted; release the claim so the candidate can
      // retry. A retry re-writes Contacts_Hub harmlessly (same values).
      await releaseClaim(token, `Deal write failed: ${message}`, responses);
      return NextResponse.json(
        { error: `Deal sync failed: ${message}` },
        { status: 502 },
      );
    }
  }

  // Mark complete. After this point, refreshes will hit the idempotent path.
  const { error: completeErr } = await supabase
    .from('assessment_progress')
    .update({
      responses,
      scores,
      is_complete: true,
      completed_at: completedAt,
      zoho_synced_at: completedAt,
      zoho_sync_error: null,
      submission_status: 'complete',
    })
    .eq('token', token);

  if (completeErr) {
    // Non-fatal: scores already in Zoho. Note it and continue.
    console.error('[submit] mark-complete update failed', completeErr);
  }

  // Kick off the analysis pipeline in the background. The client never waits
  // on this — even if the user closes the tab, waitUntil keeps the serverless
  // function alive until the pipeline resolves.
  const candidateName = candidate.firstName || row.first_name || 'Candidate';
  waitUntil(
    runAnalysisPipeline({
      token,
      candidateName,
      scores,
      recordId: row.zoho_record_id,
      dealId: shouldWriteDeal ? (candidate.dealId as string) : null,
    }),
  );

  return NextResponse.json({ ok: true, scores, primary });
}

/**
 * Reset submission_status back to 'pending' on Zoho failure so the candidate
 * can retry. Also persists the responses so partial state isn't lost.
 */
async function releaseClaim(
  token: string,
  errorMessage: string,
  responses: unknown,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('assessment_progress')
    .update({
      submission_status: 'pending',
      zoho_sync_error: errorMessage,
      responses,
    })
    .eq('token', token);
  if (error) {
    console.error('[submit] releaseClaim failed', error);
  }
}

type PipelineArgs = {
  token: string;
  candidateName: string;
  scores: Scores;
  recordId: string;
  dealId: string | null; // already gated by the Opportunity Owner check
};

async function runAnalysisPipeline(args: PipelineArgs): Promise<void> {
  const supabase = getSupabase();
  try {
    const analysis = await generateAnalysis(args.candidateName, args.scores);
    const pdfBuffer = await renderToBuffer({
      name: args.candidateName,
      scores: args.scores,
      analysis,
    });
    const longUrl = await uploadPdf(args.token, pdfBuffer);

    // Shorten before pushing to Zoho — the raw signed URL is ~800 chars,
    // which exceeds Zoho's URL field limit and looks ugly in CRM.
    const code = await createShortLink(longUrl);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const shortUrl = appUrl ? `${appUrl}/r/${code}` : `/r/${code}`;

    await writeAnalysisUrl(CONTACTS_HUB_MODULE, args.recordId, shortUrl);
    if (args.dealId) {
      await writeAnalysisUrl(DEAL_MODULE, args.dealId, shortUrl);
    }

    await supabase
      .from('assessment_progress')
      .update({
        analysis_json: analysis,
        analysis_url: longUrl, // raw signed URL preserved for our records
        analysis_error: null,
      })
      .eq('token', args.token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[submit] analysis pipeline failed', message);
    await supabase
      .from('assessment_progress')
      .update({ analysis_error: message })
      .eq('token', args.token);
  }
}
