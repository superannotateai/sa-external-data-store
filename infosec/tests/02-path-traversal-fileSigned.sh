#!/usr/bin/env bash
# Attempt local path traversal via /storage/fileSigned (original sec eng PoC + variants).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

EXPIRES=$(( ($(date +%s) + 86400) * 1000 ))

run_traversal_case() {
  local label="$1"
  local path_arg="$2"
  local sig_path="$3"

  local sig
  sig=$(sign_local_path "${sig_path}" "${EXPIRES}")
  local enc
  enc=$(urlencode "${path_arg}")

  local code
  code=$(curl_body "${BASE_URL}/storage/fileSigned?path=${enc}&expires=${EXPIRES}&signature=${sig}")
  echo "Case: ${label}"
  cat /tmp/infosec_body.json
  echo ""

  # Must NOT return 200 with system file content
  if [[ "${code}" == "200" ]]; then
    if head -c 64 /tmp/infosec_body.json | grep -qE 'root:|daemon:|/bin/'; then
      echo "CRITICAL: traversal may have returned passwd-like content"
      return 1
    fi
    echo "WARN: HTTP 200 for traversal case — verify body manually"
    return 1
  fi

  # After fix: expect 400 (path) or 401 (sig mismatch / path rejected in validateSignature)
  assert_status_in "${label}" "${code}" "400" "401" "404"
}

echo "Target: ${BASE_URL}"
echo "Using LOCAL_SIGN_SECRET_KEY length: ${#LOCAL_SIGN_SECRET_KEY}"

run_traversal_case "classic dot-dot" "../../../../../../etc/passwd" "../../../../../../etc/passwd"
run_traversal_case "encoded dots" "..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd" "..%2F..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd"
run_traversal_case "absolute path" "/etc/passwd" "/etc/passwd"
run_traversal_case "null byte suffix" $'1/2/file.pdf%00.txt' $'1/2/file.pdf%00.txt'

echo "Path traversal probes did not achieve obvious file read."
