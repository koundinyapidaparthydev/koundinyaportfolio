#!/usr/bin/env bash
# Cron entrypoint for the unified jobs pipeline.
# Install (every 10 minutes):
#   crontab -e
#   */10 * * * * /Users/YOU/path/koundinya-portfolio/scripts/cron/run-jobs-pipeline.sh
#
# Essentials: Node 22+, Playwright chromium, .env.local in repo root, Mac awake or always-on host.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export PATH="/usr/local/bin:/opt/homebrew/bin:${PATH:-/usr/bin:/bin}"

LOCK_FILE="${JOBS_PIPELINE_LOCK:-/tmp/koundinya-jobs-pipeline.lock}"
LOG_DIR="${JOBS_PIPELINE_LOG_DIR:-$ROOT/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/jobs-pipeline.log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) skip — previous run still active" >>"$LOG_FILE"
  exit 0
fi

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

NODE_BIN="${NODE_BIN:-$(command -v node)}"
if [[ -z "$NODE_BIN" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) error — node not found in PATH" >>"$LOG_FILE"
  exit 1
fi

{
  echo ""
  echo "======== $(date -u +%Y-%m-%dT%H:%M:%SZ) cron start ========"
  "$NODE_BIN" scripts/run-jobs-pipeline.mjs
  echo "======== $(date -u +%Y-%m-%dT%H:%M:%SZ) cron end ========"
} >>"$LOG_FILE" 2>&1
