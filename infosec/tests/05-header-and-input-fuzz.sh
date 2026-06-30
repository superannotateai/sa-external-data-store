#!/usr/bin/env bash
# Path/header fuzzing on protected routes.
# In the item-manifest design the storage path is derived from SuperAnnotate
# (getItem), never from client headers, so there is no sa-file-path to abuse.
# This probe confirms malformed IDs never yield a 200 file leak and that the
# legacy client-path header is gone.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

TOKEN="${SA_ACCESS_TOKEN:-invalid-token-for-fuzz}"

probe() {
  local label="$1"
  local endpoint="$2"
  shift 2
  local code
  code=$(curl_body "${BASE_URL}${endpoint}" \
    -H "x-sa-access-token: ${TOKEN}" \
    "$@")
  echo "${label}: HTTP ${code}"
  head -c 200 /tmp/infosec_body.json
  echo ""
  # Any 200 here would mean an unauthenticated/invalid-token caller got data.
  if [[ "${code}" == "200" ]]; then
    echo "FAIL: ${label} returned 200"
    exit 1
  fi
}

echo "Target: ${BASE_URL} (token is placeholder unless SA_ACCESS_TOKEN set)"

# Legacy client-controlled path header must no longer be honored anywhere.
probe "legacy sa-file-path on /storage/" "/storage/" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-file-path: ../../../../../../etc/passwd"

# Malformed numeric identifiers on the new item-based surface.
probe "negative team id (/storage/)" "/storage/" \
  -H "sa-team-id: -1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4"

probe "zero project id (/storage/)" "/storage/" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 0" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4"

probe "non-numeric team id (/annotation/)" "/annotation/" \
  -H "sa-team-id: abc" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4"

probe "missing folder/item (/storage/)" "/storage/" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2"

echo "Header fuzz completed."
