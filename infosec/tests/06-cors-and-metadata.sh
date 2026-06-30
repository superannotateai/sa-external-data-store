#!/usr/bin/env bash
# CORS, security headers, and fingerprinting.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

HDR_FILE="/tmp/infosec_headers.txt"

curl -sS -D "${HDR_FILE}" -o /dev/null -X OPTIONS "${BASE_URL}/annotation/" \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: GET"

if grep -qi 'Access-Control-Allow-Origin: \*' "${HDR_FILE}"; then
  echo "FINDING: CORS allows any origin (*)"
else
  echo "OK: CORS is not wildcard"
fi

curl -sS -D "${HDR_FILE}" -o /dev/null "${BASE_URL}/health"

for h in "X-Content-Type-Options" "X-Frame-Options" "Content-Security-Policy" "Strict-Transport-Security"; do
  if grep -qi "^${h}:" "${HDR_FILE}"; then
    echo "OK: ${h} present"
  else
    echo "FINDING: missing ${h} on /health"
  fi
done

if grep -qi 'X-Powered-By: Express' "${HDR_FILE}"; then
  echo "FINDING: X-Powered-By exposes Express"
fi

echo "CORS/metadata probes completed."
