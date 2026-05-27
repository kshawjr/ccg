import { randomBytes } from 'node:crypto';
import { getSupabase } from './supabase';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 7; // 62^7 ≈ 3.5e12 — collisions are vanishingly rare
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    // Modulo 62 has a tiny bias for byte values 248..255 — irrelevant for a
    // 7-char identifier whose only requirement is unguessability + uniqueness.
    out += BASE62[bytes[i] % 62];
  }
  return out;
}

/**
 * Insert a row into `short_links` and return the generated 7-char code.
 * Retries up to 5 times on Postgres unique_violation (23505) — the only
 * collision path. Any other error is thrown.
 */
export async function createShortLink(longUrl: string): Promise<string> {
  if (!longUrl || typeof longUrl !== 'string') {
    throw new Error('createShortLink: longUrl must be a non-empty string');
  }
  const supabase = getSupabase();
  let lastErrMessage = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    const { error } = await supabase
      .from('short_links')
      .insert({ code, long_url: longUrl });
    if (!error) return code;
    // PostgREST passes through Postgres error codes via `error.code`.
    if (error.code !== '23505') {
      throw new Error(`Short link insert failed: ${error.message}`);
    }
    lastErrMessage = error.message;
  }
  throw new Error(
    `Short link collision retries exhausted after ${MAX_ATTEMPTS} attempts: ${lastErrMessage}`,
  );
}
