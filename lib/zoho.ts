import type { Color, Scores } from './types';

// Rename these in one place if the CRM admin uses different field API names.
export const ZOHO_FIELDS = {
  orange: 'True_Colors_Orange',
  blue: 'True_Colors_Blue',
  gold: 'True_Colors_Gold',
  green: 'True_Colors_Green',
  primary: 'True_Colors_Primary',
  completedAt: 'True_Colors_Completed_At',
} as const;

export type ZohoModule = 'Leads' | 'Contacts' | 'Deals';

function accountsBase(): string {
  return process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.com';
}

function apiBase(): string {
  return process.env.ZOHO_API_BASE || 'https://www.zohoapis.com';
}

// In-process access token cache. Cold-starts fine; each invocation refreshes once.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN');
  }
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`${accountsBase()}/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }
  let body: { access_token?: string; expires_in?: number; error?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Zoho token refresh: non-JSON response: ${text}`);
  }
  if (body.error || !body.access_token) {
    throw new Error(`Zoho token refresh error: ${body.error || 'no access_token'}`);
  }
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return tokenCache.token;
}

type ZohoRecord = Record<string, unknown>;

export type ZohoCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

/** Fetch a single record from a module and pluck the name fields. */
export async function fetchCandidate(module: ZohoModule, recordId: string): Promise<ZohoCandidate> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/crm/v6/${module}/${encodeURIComponent(recordId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    cache: 'no-store',
  });
  if (res.status === 204) {
    throw new Error(`Zoho ${module}/${recordId}: not found`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho fetch failed (${res.status}): ${text}`);
  }
  const body = JSON.parse(text) as { data?: ZohoRecord[] };
  const record = body.data?.[0];
  if (!record) {
    throw new Error(`Zoho ${module}/${recordId}: empty response`);
  }
  // Deals don't have First_Name/Last_Name natively; fall back to Deal_Name or Contact_Name.
  const first = pickString(record, ['First_Name']);
  const last = pickString(record, ['Last_Name']);
  const email = pickString(record, ['Email', 'Secondary_Email']);

  let firstName = first;
  let lastName = last;

  if (!firstName && !lastName) {
    // Try Deal_Name then Contact_Name (which arrives as { name: ..., id: ... }).
    const dealName = pickString(record, ['Deal_Name']);
    const contactName = pickContactName(record);
    const full = dealName || contactName;
    if (full) {
      const parts = full.trim().split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(' ') || null;
    }
  }

  return {
    id: recordId,
    firstName,
    lastName,
    email,
  };
}

function pickString(record: ZohoRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = record[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function pickContactName(record: ZohoRecord): string | null {
  const v = record['Contact_Name'];
  if (v && typeof v === 'object' && 'name' in v) {
    const name = (v as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  }
  return null;
}

/** Write the assessment results back to a Zoho record. */
export async function writeResults(
  module: ZohoModule,
  recordId: string,
  scores: Scores,
  primary: Color,
  completedAtIso: string,
): Promise<void> {
  const token = await getAccessToken();
  const payload = {
    data: [
      {
        id: recordId,
        [ZOHO_FIELDS.orange]: scores.orange,
        [ZOHO_FIELDS.blue]: scores.blue,
        [ZOHO_FIELDS.gold]: scores.gold,
        [ZOHO_FIELDS.green]: scores.green,
        [ZOHO_FIELDS.primary]: primary.charAt(0).toUpperCase() + primary.slice(1),
        [ZOHO_FIELDS.completedAt]: completedAtIso,
      },
    ],
  };
  const res = await fetch(`${apiBase()}/crm/v6/${module}`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho write failed (${res.status}): ${text}`);
  }
  // Zoho returns 200 even when individual rows fail; check per-record status.
  try {
    const body = JSON.parse(text) as { data?: Array<{ code?: string; message?: string; status?: string }> };
    const row = body.data?.[0];
    if (row && row.status && row.status !== 'success') {
      throw new Error(`Zoho per-record error: ${row.code || ''} ${row.message || ''}`.trim());
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Zoho per-record')) throw err;
    // JSON parse fall-through is harmless when status is 2xx.
  }
}
