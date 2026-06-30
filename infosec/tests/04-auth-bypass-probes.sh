#!/usr/bin/env bash
# Authentication edge cases (no valid SA token required).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

echo "Target: ${BASE_URL}"

# Invalid token should not reach handler with 200
code=$(curl_body "${BASE_URL}/annotation/" \
  -H "x-sa-access-token: not-a-valid-jwt" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 1" \
  -H "sa-item-id: 1")
assert_status_in "invalid token" "${code}" "401" "500"
if [[ "${code}" == "500" ]]; then
  echo "NOTE: invalid token yields 500 (SA API error) — prefer 401 to avoid ambiguity"
fi

# Empty Bearer
code=$(curl_body "${BASE_URL}/annotation/" \
  -H "x-sa-access-token: " \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 1" \
  -H "sa-item-id: 1")
assert_status_in "empty token" "${code}" "401" "400" "500"

# Duplicate headers (array) — Express uses first value typically
code=$(curl_body "${BASE_URL}/annotation/" \
  -H "x-sa-access-token: invalid" \
  -H "x-sa-access-token: also-invalid" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 1" \
  -H "sa-item-id: 1")
assert_status_in "duplicate auth headers" "${code}" "401" "500"

echo "Auth bypass probes completed (no bypass demonstrated without valid token)."
