import { getSupabase } from './supabase';

export const ANALYSIS_BUCKET = 'tc-analysis';
const SIGNED_URL_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/**
 * Upload (or overwrite) a candidate's analysis PDF and return a signed URL
 * valid for 90 days. The bucket is expected to exist already (private). The
 * object key is `${token}.pdf`.
 */
export async function uploadPdf(token: string, buffer: Buffer): Promise<string> {
  const supabase = getSupabase();
  const objectKey = `${token}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from(ANALYSIS_BUCKET)
    .upload(objectKey, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
  }

  const { data, error: signErr } = await supabase.storage
    .from(ANALYSIS_BUCKET)
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);
  if (signErr || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message || 'no url returned'}`);
  }
  return data.signedUrl;
}
