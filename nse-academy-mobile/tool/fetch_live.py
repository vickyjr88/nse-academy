#!/usr/bin/env python3
"""Downloads the recordings the screenshot test asked for (see tool/store_screenshots_test.dart)."""
import os, subprocess, sys
cache = os.environ["LIVE_CACHE"]
miss = os.path.join(cache, "_misses.txt")
if not os.path.exists(miss):
    sys.exit("nothing missing")
seen = {}
for line in open(miss):
    name, url = line.rstrip("\n").split("\t", 1)
    seen[name] = url
os.remove(miss)
for name, url in seen.items():
    out = os.path.join(cache, name + ".json")
    r = subprocess.run(["curl", "-sfL", "--max-time", "60", "-o", out, url])
    print("ok  " if r.returncode == 0 else "FAIL", url[:110])
