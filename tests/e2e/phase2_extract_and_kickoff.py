#!/usr/bin/env python3
"""Phase 2 — extract_terms in parallel for each policy, verify the resulting
DB rows, then kick off coverage_priority on the matter (returns immediately
with an analysisId; the engine runs in the background).

Runs in ~15-25s. Reads .state.json from phase 1.
"""

import os, sys, time, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import fn, rest_get, save_state, load_state

def main():
    state = load_state()
    if not state.get('policies'):
        raise SystemExit('No state from phase 1; run phase1_upload_and_classify.py first.')

    print('=== Phase 2 ===\n')
    print(f'extract_terms in parallel for {len(state["policies"])} polic{"y" if len(state["policies"]) == 1 else "ies"}...')

    threads, results = [], {}
    def worker(pol):
        t0 = time.time()
        try:
            out = fn('analyze-policy', {'mode': 'extract_terms', 'policyId': pol['policy_id']})
            results[pol['policy_id']] = {'ok': bool(out.get('ok')), 'sec': time.time() - t0}
        except Exception as e:
            results[pol['policy_id']] = {'ok': False, 'err': str(e)[:200], 'sec': time.time() - t0}
    for pol in state['policies']:
        t = threading.Thread(target=worker, args=(pol,))
        t.start(); threads.append(t)
    for t in threads:
        t.join(timeout=60)
    for pol in state['policies']:
        r = results.get(pol['policy_id'], {})
        err = (' err: ' + r.get('err','')) if not r.get('ok') else ''
        print(f'  {pol["filename"]:32} ok={r.get("ok")} took={r.get("sec", -1):.1f}s{err}')

    print('\nVerifying extraction_status in DB...')
    for pol in state['policies']:
        rows = rest_get(
            'lc_policies',
            f'?id=eq.{pol["policy_id"]}&select=id,carrier,policy_number,policy_form,'
            f'per_occurrence_limit,other_insurance_type,extraction_status,extraction_error',
        )
        if rows:
            r = rows[0]
            print(
                f'  {pol["filename"]:32} status={r["extraction_status"]:11} '
                f'carrier={r.get("carrier") or "—":<32} '
                f'OI={r.get("other_insurance_type") or "—":<22} '
                f'limit=${(r.get("per_occurrence_limit") or 0):,}'
            )

    print(f'\nKicking off coverage_priority on matter {state["matter_id"]}')
    out = fn('analyze-policy', {
        'mode':     'coverage_priority',
        'matterId': state['matter_id'],
    })
    state['analysis_id']         = out.get('analysisId')
    state['analysis_started_at'] = time.time()
    save_state(state)
    print(f'  analysis_id: {state["analysis_id"]}  status: {out.get("status")}')
    print('\nState checkpointed. Phase 2 complete. Run phase 3 to poll for completion.')

if __name__ == '__main__':
    main()
