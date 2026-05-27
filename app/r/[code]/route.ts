import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: { code: string } },
) {
  const code = ctx.params.code;
  if (!code || typeof code !== 'string' || code.length > 32) {
    return new NextResponse('Not found', { status: 404 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('short_links')
    .select('long_url')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('[r/code] lookup error', error);
    return new NextResponse('Not found', { status: 404 });
  }
  if (!data?.long_url) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.redirect(data.long_url, 302);
}
