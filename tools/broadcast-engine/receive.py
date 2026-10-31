"""Bounded local RTMPS rehearsal. Stdin carries WebM; stdout carries the decoded receipt."""
import json
import sys
from native_engine import LoopbackSession, MAX_CHUNK

def main():
    if sys.platform == 'win32':
        from windows_runtime import own_process_tree, release_process_tree
        job = own_process_tree()
    session = LoopbackSession()
    try:
        seq = 0
        while True:
            chunk = sys.stdin.buffer.read1(MAX_CHUNK)
            if not chunk:
                break
            session.write(seq, chunk)
            seq += 1
        print(json.dumps(session.finish()), flush=True)
    finally:
        session.close()
        if sys.platform == 'win32':
            release_process_tree(job)

if __name__ == '__main__':
    main()
