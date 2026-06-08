#!/usr/bin/env bash
# HMAC / signed URL abuse probes for /storage/fileSigned.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

SAFE_PATH="1/2/3/4/test-nonexistent.pdf"
FUTURE=$(( ($(date +%s) + 86400) * 1000 ))
PAST=$(( ($(date +%s) - 3600) * 1000 ))

echo "Target: ${BASE_URL}"

# Wrong secret / garbage signature
code=$(curl_body "${BASE_URL}/storage/fileSigned?path=$(urlencode "${SAFE_PATH}")&expires=${FUTURE}&signature=deadbeef")
assert_status_in "invalid hex signature" "${code}" "401" "400"

# Expired token
good_sig=$(sign_local_path "${SAFE_PATH}" "${PAST}")
code=$(curl_body "${BASE_URL}/storage/fileSigned?path=$(urlencode "${SAFE_PATH}")&expires=${PAST}&signature=${good_sig}")
assert_status "401" "${code}" "expired signature"
body_contains "INVALID_SIGNATURE"

# Tamper path after signing (signature for different path)
sig=$(sign_local_path "${SAFE_PATH}" "${FUTURE}")
tampered="1/2/3/4/other.pdf"
code=$(curl_body "${BASE_URL}/storage/fileSigned?path=$(urlencode "${tampered}")&expires=${FUTURE}&signature=${sig}")
assert_status "401" "${code}" "path tamper"

# Empty signature
code=$(curl_body "${BASE_URL}/storage/fileSigned?path=$(urlencode "${SAFE_PATH}")&expires=${FUTURE}&signature=")
assert_status_in "empty signature" "${code}" "400" "401"

echo "Signature abuse probes completed."
