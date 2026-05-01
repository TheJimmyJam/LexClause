#!/usr/bin/env python3
"""Phase 1 — upload sample PDFs to lc-matter-docs, classify each, create the
matter row, run extract_allegations on the complaint, and stage the policy
PDFs in lc-policies.

Runs in ~30s. State is checkpointed to .state.json so phases 2 and 3 can
resume without redoing work.
"""

import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (
    PDF_DIR, CREDS, fn, upload, rest_insert, find_org_id_for_email, save_state
)

POLICY_FILES = [
    ('LibertyMutual_CGL.pdf', 'CGL_OCCURRENCE'),
    ('Travelers_CGL.pdf',     'CGL_OCCURRENCE'),
]
COMPLAINT_FILE = 'Complaint_Acme_v_Greenfield.pdf'
EMAIL = CREDS.get('LEXCLAUSE_LOGIN_PRIMARY_EMAIL')

def main():
    if not EMAIL:
        raise SystemExit('LEXCLAUSE_LOGIN_PRIMARY_EMAIL is not set in credentials')

    print('=== Phase 1 ===\n')
    org_id = find_org_id_for_email(EMAIL)
    print(f'org_id: {org_id}')

    state = {
        'org_id':          org_id,
        'email':           EMAIL,
        'started_at':      time.time(),
        'classifications': {},
        'policies':        [],
    }

    all_files = [COMPLAINT_FILE] + [p[0] for p in POLICY_FILES]
    for fname in all_files:
        local_path = os.path.join(PDF_DIR, fname)
        if not os.path.exists(local_path):
            raise SystemExit(f'Missing sample PDF: {local_path}\nRun gen_sample_pdfs.py first.')
        with open(local_path, 'rb') as f:
            pdf_bytes = f.read()
        path = f'{org_id}/e2e-{int(time.time())}-{fname}'
        upload('lc-matter-docs', path, pdf_bytes)
        print(f'  uploaded {fname} → lc-matter-docs/{path}')
        out = fn('analyze-policy', {
            'mode':        'classify_document',
            'storagePath': path,
            'bucket':      'lc-matter-docs',
        })
        c = out.get('parsed', {})
        kind = c.get('kind')
        form = c.get('policy_form')
        print(f'  classified: {fname:42} kind={kind:<14} form={form or "—":<20} venue={c.get("venue_state") or "—"}')
        state['classifications'][fname] = {
            'storagePath': path,
            'kind':        kind,
            'policy_form': form,
            'venue_state': c.get('venue_state'),
            'confidence':  c.get('confidence'),
        }

    trigger = state['classifications'][COMPLAINT_FILE]
    venue_state = trigger.get('venue_state') or 'TX'
    matter_row = rest_insert('lc_matters', {
        'org_id':                    org_id,
        'name':                      'E2E Test — Acme Properties v. Greenfield Builders',
        'governing_state':           venue_state,
        'venue_state':               venue_state,
        'source_document_path':      trigger['storagePath'],
        'source_document_filename':  COMPLAINT_FILE,
        'source_document_type':      trigger['kind'],
    })[0]
    matter_id = matter_row['id']
    state['matter_id']        = matter_id
    state['governing_state']  = venue_state
    print(f'\nmatter_id: {matter_id}  governing_state: {venue_state}')

    print('\nextract_allegations on the complaint...')
    out = fn('analyze-policy', {
        'mode':        'extract_allegations',
        'storagePath': trigger['storagePath'],
        'matterId':    matter_id,
    })
    p = out.get('parsed', {})
    print(f'  matter_name: {p.get("matter_name")}')
    print(f'  loss_type:   {p.get("loss_type")}  venue_state: {p.get("venue_state")}')
    print(f'  allegations: {len(p.get("allegations") or [])}')
    for a in (p.get('allegations') or []):
        print(f'    - {a.get("theory_of_liability")}  |  harm: {a.get("harm_type")}')

    print('\nCopying policies → lc-policies and creating policy rows...')
    for fname, _form_hint in POLICY_FILES:
        cls = state['classifications'][fname]
        with open(os.path.join(PDF_DIR, fname), 'rb') as f:
            pdf_bytes = f.read()
        new_path = f'{org_id}/e2e-{int(time.time())}-{fname}'
        upload('lc-policies', new_path, pdf_bytes)
        pol_row = rest_insert('lc_policies', {
            'org_id':              org_id,
            'source_filename':     fname,
            'source_storage_path': new_path,
            'policy_form':         cls.get('policy_form') or 'OTHER',
            'extraction_status':   'pending',
        })[0]
        pol_id = pol_row['id']
        rest_insert('lc_matter_policies', {
            'matter_id': matter_id,
            'policy_id': pol_id,
            'role':      'subject',
        })
        state['policies'].append({'filename': fname, 'policy_id': pol_id, 'storage_path': new_path})
        print(f'  policy {fname:30} → lc_policies row {pol_id}')

    save_state(state)
    print('\nState checkpointed to .state.json. Phase 1 complete.')

if __name__ == '__main__':
    main()
