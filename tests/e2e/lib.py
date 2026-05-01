"""Shared helpers for the LexClause E2E test runner.

Reads Supabase + Resend credentials from a `.credentials` file. Path resolution
order:
  1. $LEXCLAUSE_CREDS_PATH if set
  2. ~/Desktop/Projects/.credentials   (default for the dev machine this was
     built on; portable enough that anyone running it points the env var at
     their own file)

Required keys in the credentials file:
  LEXCLAUSE_SUPABASE_URL              — https://<ref>.supabase.co
  LEXCLAUSE_SUPABASE_SERVICE_ROLE_KEY — JWT
  LEXCLAUSE_SUPABASE_ANON_KEY         — JWT

Optional:
  LEXCLAUSE_LOGIN_PRIMARY_EMAIL       — used to look up the test org_id
"""

import json, os, urllib.request, urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR    = os.path.join(SCRIPT_DIR, 'sample_pdfs')
STATE_PATH = os.path.join(SCRIPT_DIR, '.state.json')

DEFAULT_CREDS = os.path.expanduser('~/Desktop/Projects/.credentials')

def load_creds():
    path = os.environ.get('LEXCLAUSE_CREDS_PATH', DEFAULT_CREDS)
    if not os.path.exists(path):
        raise SystemExit(
            f'Credentials file not found at {path!r}. '
            f'Set LEXCLAUSE_CREDS_PATH or place a .credentials file at the default path.'
        )
    out = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                out[k] = v
    return out

CREDS = load_creds()
URL   = CREDS['LEXCLAUSE_SUPABASE_URL']
SVC   = CREDS['LEXCLAUSE_SUPABASE_SERVICE_ROLE_KEY']
ANON  = CREDS['LEXCLAUSE_SUPABASE_ANON_KEY']

REST_HDRS = {
    'apikey':        SVC,
    'Authorization': f'Bearer {SVC}',
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
}
FN_HDRS = {
    'apikey':        ANON,
    'Authorization': f'Bearer {SVC}',
    'Content-Type':  'application/json',
}

def http(method, url, *, body=None, hdrs=None, timeout=60, raw=False):
    data = body if isinstance(body, (bytes, bytearray)) else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = r.read()
            if not payload:
                return r.status, None
            return r.status, (payload if raw else json.loads(payload.decode()))
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:1000]
        raise RuntimeError(f'HTTP {e.code} on {url}: {msg}')

def rest_get(table, query=''):
    return http('GET', f'{URL}/rest/v1/{table}{query}', hdrs=REST_HDRS)[1]

def rest_insert(table, row):
    return http('POST', f'{URL}/rest/v1/{table}', body=row, hdrs=REST_HDRS)[1]

def rest_patch(table, query, patch):
    return http('PATCH', f'{URL}/rest/v1/{table}{query}', body=patch, hdrs=REST_HDRS)[1]

def fn(slug, body):
    """Invoke a Supabase Edge Function with service-role auth."""
    return http('POST', f'{URL}/functions/v1/{slug}', body=body, hdrs=FN_HDRS, timeout=120)[1]

def upload(bucket, path, pdf_bytes):
    """Upload PDF bytes to a Supabase Storage bucket. Returns the canonical path."""
    hdrs = {
        'Authorization': f'Bearer {SVC}',
        'Content-Type':  'application/pdf',
        'x-upsert':      'true',
    }
    http('POST', f'{URL}/storage/v1/object/{bucket}/{path}', body=pdf_bytes, hdrs=hdrs, raw=True)
    return path

def find_org_id_for_email(email):
    """Look up the org_id for the given email via the auth admin API + lc_profiles."""
    hdrs = {'Authorization': f'Bearer {SVC}', 'apikey': SVC}
    status, data = http('GET', f'{URL}/auth/v1/admin/users?email={email}', hdrs=hdrs)
    users = data.get('users') if data and isinstance(data, dict) else None
    if not users:
        # Some Supabase versions return the user object directly when filtering by email
        users = [data] if data and data.get('id') else []
    if not users:
        raise RuntimeError(f'no auth.users row for {email}')
    user_id = users[0]['id']
    profiles = rest_get('lc_profiles', f'?id=eq.{user_id}&select=org_id')
    if not profiles:
        raise RuntimeError(f'no lc_profiles row for user {user_id}')
    return profiles[0]['org_id']

def save_state(state):
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, indent=2)

def load_state():
    if not os.path.exists(STATE_PATH):
        return {}
    with open(STATE_PATH) as f:
        return json.load(f)

def clear_state():
    if os.path.exists(STATE_PATH):
        os.remove(STATE_PATH)
