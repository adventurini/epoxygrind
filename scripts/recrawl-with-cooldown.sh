#!/bin/bash
# Wraps recrawl-outreach-excluded.mjs: that script aborts a pass after 5
# consecutive resource-exhaustion failures (exit code 2) rather than
# burning through the whole list against a degraded Vercel container.
# This loop gives it a real cooldown after an abort, then resumes —
# already-cleared contractors won't be re-targeted since the inner script
# re-queries current status each pass. Caps at MAX_PASSES as a safety
# bound against looping forever if the underlying issue never clears.
# Deliberately NOT `set -e` — the inner node script exits 2 as its NORMAL
# signal to "cool down and resume", not a fatal error. set -e aborted the
# whole wrapper on that expected exit code the first time this ran, so the
# retry loop below never actually got a chance to execute at all.
cd "$(dirname "$0")/.."

COOLDOWN_SECONDS=300
MAX_PASSES=40
LOG=scripts/recrawl-progress.log

pass=1
node scripts/recrawl-outreach-excluded.mjs --resume
code=$?

while [ "$code" -eq 2 ] && [ "$pass" -lt "$MAX_PASSES" ]; do
  pass=$((pass + 1))
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cooling down ${COOLDOWN_SECONDS}s before pass ${pass}..." >> "$LOG"
  sleep "$COOLDOWN_SECONDS"
  node scripts/recrawl-outreach-excluded.mjs --resume
  code=$?
done

if [ "$code" -eq 0 ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] All passes complete — nothing left to recrawl." >> "$LOG"
elif [ "$pass" -ge "$MAX_PASSES" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Hit MAX_PASSES (${MAX_PASSES}) — stopping. Some targets may remain." >> "$LOG"
fi
