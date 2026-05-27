import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { isValidShape } from '@/lib/scoring';

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
  if (!isValidShape(responses)) {
    return NextResponse.json({ error: 'Invalid responses shape' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Look up the row first so we can preserve started_at semantics.
  const { data: existing, error: lookupErr } = await supabase
    .from('assessment_progress')
    .select('token, is_complete, started_at')
    .eq('token', token)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }
  if (existing.is_complete) {
    return NextResponse.json({ error: 'Assessment already submitted' }, { status: 409 });
  }

  const update: Record<string, unknown> = { responses };
  if (!existing.started_at) update.started_at = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('assessment_progress')
    .update(update)
    .eq('token', token);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
