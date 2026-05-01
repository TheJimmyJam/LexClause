#!/usr/bin/env python3
"""Run all three E2E phases sequentially. Convenience wrapper around the
individual phase scripts, useful when running from a normal terminal (the
phases exist as separate scripts because the original sandbox had a 45s-per-
call timeout that made one big run impossible).

Usage:
    python3 run_all.py
"""

import os, sys, runpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

PHASES = [
    'phase1_upload_and_classify.py',
    'phase2_extract_and_kickoff.py',
    'phase3_poll_and_verify.py',
]

def main():
    for phase in PHASES:
        path = os.path.join(SCRIPT_DIR, phase)
        print(f'\n>>> Running {phase}')
        try:
            runpy.run_path(path, run_name='__main__')
        except SystemExit as e:
            if e.code:
                print(f'\n!!! {phase} exited with code {e.code}; aborting.')
                sys.exit(e.code)

if __name__ == '__main__':
    main()
