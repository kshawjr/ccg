import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSupabase } from '@/lib/supabase';
import { CONTACTS_HUB_MODULE, fetchContactsHub } from '@/lib/zoho';
import { emptyResponses } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: 'ADMIN_API_KEY not configured' }, { status: 500 });
  }
  if (req.headers.get('x-admin-key') !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { recordId } = body as { recordId?: unknown };
  if (typeof recordId !== 'string' || recordId.trim().length === 0) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  let candidate;
  try {
    candidate = await fetchContactsHub(recordId.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const token = base64url(randomBytes(18));

  const supabase = getSupabase();
  const { error } = await supabase.from('assessment_progress').insert({
    token,
    zoho_module: CONTACTS_HUB_MODULE,
    zoho_record_id: recordId.trim(),
    first_name: candidate.firstName,
    last_name: candidate.lastName,
    email: candidate.email,
    responses: emptyResponses(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const url = appUrl ? `${appUrl.replace(/\/$/, '')}/${token}` : `/${token}`;

  return NextResponse.json({
    token,
    url,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
  });
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
