"""Bounded local RTMPS rehearsal. Stdin carries WebM; stdout carries the decoded receipt."""
import json
import sys
from native_engine import LoopbackSession, MAX_CHUNK

def main():
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

if __name__ == '__main__':
    main()
