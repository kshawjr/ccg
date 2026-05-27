import type { Scores } from './types';

// Rename these in one place if the CRM admin uses different field API names.
// Same five fields live on both Contacts_Hub and Deals.
export const ZOHO_FIELDS = {
  orange: 'Orange',
  blue: 'Blue',
  gold: 'Gold',
  green: 'Green',
  received: 'True_Colors_Rcvd',
} as const;

export const CONTACTS_HUB_MODULE = 'Contacts_Hub';
export const DEAL_MODULE = 'Deals';
export const OPPORTUNITY_OWNER = 'Opportunity Owner';

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

export type ContactsHubRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  relationship: string | null;
  dealId: string | null;
};

/** Fetch a Contacts_Hub record and pluck the candidate identity + routing fields. */
export async function fetchContactsHub(recordId: string): Promise<ContactsHubRecord> {
  const token = await getAccessToken();
  const res = await fetch(
    `${apiBase()}/crm/v6/${CONTACTS_HUB_MODULE}/${encodeURIComponent(recordId)}`,
    {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      cache: 'no-store',
    },
  );
  if (res.status === 204) {
    throw new Error(`${CONTACTS_HUB_MODULE}/${recordId}: not found`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho fetch failed (${res.status}): ${text}`);
  }
  const body = JSON.parse(text) as { data?: ZohoRecord[] };
  const record = body.data?.[0];
  if (!record) {
    throw new Error(`${CONTACTS_HUB_MODULE}/${recordId}: empty response`);
  }

  const email = pickString(record, ['Email', 'Secondary_Email']);
  const relationship = pickString(record, ['Relationship']);
  const dealId = pickLookupId(record, 'Deal');

  // Names live on the linked Contact record, not on Contacts_Hub itself.
  let firstName: string | null = null;
  let lastName: string | null = null;
  const contactId = pickLookupId(record, 'Contact');
  if (contactId) {
    try {
      const contactToken = await getAccessToken();
      const contactRes = await fetch(
        `${apiBase()}/crm/v6/Contacts/${encodeURIComponent(contactId)}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${contactToken}` },
          cache: 'no-store',
        },
      );
      if (contactRes.ok) {
        const contactBody = JSON.parse(await contactRes.text()) as { data?: ZohoRecord[] };
        const contactRecord = contactBody.data?.[0];
        if (contactRecord) {
          firstName = pickString(contactRecord, ['First_Name']);
          lastName = pickString(contactRecord, ['Last_Name']);
        } else {
          console.warn(`[zoho] Contacts/${contactId} returned empty data`);
        }
      } else {
        console.warn(
          `[zoho] Contacts/${contactId} fetch failed (${contactRes.status})`,
        );
      }
    } catch (err) {
      console.warn(`[zoho] Contacts/${contactId} fetch error`, err);
    }
  }

  return { id: recordId, firstName, lastName, email, relationship, dealId };
}

/**
 * Write the five True Colors fields to any module (Contacts_Hub or Deals).
 * `True_Colors_Rcvd` is a Zoho Date field, so we send YYYY-MM-DD.
 */
export async function writeResults(
  module: string,
  recordId: string,
  scores: Scores,
): Promise<void> {
  const token = await getAccessToken();
  const today = todayYmd();
  // The Orange/Blue/Gold/Green fields on Contacts_Hub and Deals are Text,
  // not Number — sending them as numbers gets INVALID_DATA back from Zoho.
  const payload = {
    data: [
      {
        id: recordId,
        [ZOHO_FIELDS.orange]: String(scores.orange),
        [ZOHO_FIELDS.blue]: String(scores.blue),
        [ZOHO_FIELDS.gold]: String(scores.gold),
        [ZOHO_FIELDS.green]: String(scores.green),
        [ZOHO_FIELDS.received]: today,
      },
    ],
  };
  const res = await fetch(`${apiBase()}/crm/v6/${encodeURIComponent(module)}`, {
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
    throw new Error(`Zoho write to ${module} failed (${res.status}): ${text}`);
  }
  try {
    const body = JSON.parse(text) as {
      data?: Array<{ code?: string; message?: string; status?: string }>;
    };
    const row = body.data?.[0];
    if (row && row.status && row.status !== 'success') {
      throw new Error(
        `Zoho ${module} per-record error: ${row.code || ''} ${row.message || ''}`.trim(),
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Zoho ')) throw err;
  }
}

function pickString(record: ZohoRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = record[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function pickLookupId(record: ZohoRecord, key: string): string | null {
  const v = record[key];
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim().length > 0) return id.trim();
  }
  return null;
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
