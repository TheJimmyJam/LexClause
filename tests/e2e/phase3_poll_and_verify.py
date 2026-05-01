#!/usr/bin/env python3
"""Phase 3 — poll the coverage_priority analysis until complete and verify
the result has the expected shape and values for the synthetic Texas
scenario.

Reads .state.json. Saves the full analysis JSON to result.json. Exits with
a non-zero status if any verification check fails (so this can be wired
into CI later if we want).
"""

import os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import rest_get, load_state

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    state = load_state()
    aid = state.get('analysis_id')
    if not aid:
        raise SystemExit('No analysis_id in state; run phase 2 first.')

    print('=== Phase 3 ===\n')
    print(f'Polling lc_analyses {aid} ...')

    deadline = time.time() + 5 * 60
    last_status, last_attempts = None, None
    analysis = None
    while time.time() < deadline:
        rows = rest_get(
            'lc_analyses',
            f'?id=eq.{aid}&select=id,status,validation_status,validation_attempts,'
            f'exhaustion_rule,priority_rule_citation,exhaustion_rule_citation,'
            f'narrative,error,raw_engine_output',
        )
        if rows:
            a = rows[0]
            if a['status'] != last_status or a.get('validation_attempts') != last_attempts:
                elapsed = int(time.time() - state.get('analysis_started_at', time.time()))
                print(f'  [{elapsed}s] status={a["status"]} attempts={a.get("validation_attempts")} validation={a.get("validation_status")}')
                last_status   = a['status']
                last_attempts = a.get('validation_attempts')
            if a['status'] in ('complete', 'failed'):
                analysis = a
                break
        time.sleep(2)
    else:
        raise SystemExit('TIMED OUT waiting for completion (>5 min)')

    if analysis['status'] == 'failed':
        print(f'\nAnalysis FAILED: {analysis.get("error")}')
        sys.exit(2)

    results = rest_get('lc_analysis_results', f'?analysis_id=eq.{aid}&order=ordering.asc&select=*')

    print(f'\n=== Result summary ===\n')
    print(f'analysis_id:         {aid}')
    print(f'validation_status:   {analysis.get("validation_status")}')
    print(f'validation_attempts: {analysis.get("validation_attempts")}')
    print(f'exhaustion_rule:     {analysis.get("exhaustion_rule")}')
    print(f'priority_citation:   {analysis.get("priority_rule_citation")}')
    print(f'exhaustion_cite:     {analysis.get("exhaustion_rule_citation")}\n')

    print('Trigger analysis (per policy):')
    for r in results:
        print(f"  {r.get('carrier'):<32} triggered={r.get('triggered'):<7} priority_rank={r.get('priority_rank') or '—'}")
        rationale = r.get('trigger_rationale') or ''
        if rationale:
            print(f"    rationale: {rationale[:160] + '…' if len(rationale) > 160 else rationale}")

    print('\nNarrative:')
    print((analysis.get('narrative') or '')[:1200])

    print('\n=== Verification (Texas scenario, BI + PD from dropped beam) ===')
    libs  = [r for r in results if 'Liberty' in (r.get('carrier') or '')]
    travs = [r for r in results if 'Travelers' in (r.get('carrier') or '')]
    cite  = (analysis.get('priority_rule_citation') or '').lower()
    checks = [
        ('Both CGLs triggered',
            bool(libs) and bool(travs)
            and libs[0].get('triggered') in ('yes','partial')
            and travs[0].get('triggered') in ('yes','partial')),
        ('Liberty Mutual ranked primary',
            bool(libs and libs[0].get('priority_rank') == 'primary')),
        ('Travelers ranked excess',
            bool(travs and travs[0].get('priority_rank') in ('excess','sub-excess'))),
        ('Exhaustion = vertical',
            analysis.get('exhaustion_rule') == 'vertical'),
        ('Priority cite from TX catalog',
            'mid-continent' in cite or 'hardware dealers' in cite or 'trinity' in cite),
        ('Narrative present',
            bool((analysis.get('narrative') or '').strip())),
        ('Validator passed',
            analysis.get('validation_status') == 'valid'),
    ]
    passed = 0
    for name, ok in checks:
        print(f'  {"✓" if ok else "✗"} {name}')
        if ok: passed += 1
    print(f'\n{passed}/{len(checks)} checks passed')

    out_path = os.path.join(SCRIPT_DIR, 'result.json')
    with open(out_path, 'w') as f:
        json.dump({'analysis': analysis, 'results': results}, f, indent=2, default=str)
    print(f'Full result saved to: {out_path}')

    sys.exit(0 if passed == len(checks) else 1)

if __name__ == '__main__':
    main()
