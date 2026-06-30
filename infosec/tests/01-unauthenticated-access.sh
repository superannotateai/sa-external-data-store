#!/usr/bin/env bash
# Probe endpoints that should not require SA auth.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

echo "Target: ${BASE_URL}"

code=$(curl_body "${BASE_URL}/health")
assert_status "200" "${code}" "GET /health"

code=$(curl_body "${BASE_URL}/storage/fileSigned")
assert_status "400" "${code}" "GET /storage/fileSigned (missing params)"
body_contains "MISSING_QUERY_PARAMETERS"

code=$(curl_body "${BASE_URL}/annotation/")
assert_status "401" "${code}" "GET /annotation/ without token"

# /storage/ (manifest -> signed URLs) is protected by AuthSaMiddleware.
code=$(curl_body "${BASE_URL}/storage/")
assert_status "401" "${code}" "GET /storage/ without token"

# Legacy endpoints were removed in the item-manifest redesign (no longer exist).
code=$(curl_body "${BASE_URL}/storage/file")
assert_status "404" "${code}" "GET /storage/file removed"

code=$(curl_body "${BASE_URL}/storage/signedUrl")
assert_status "404" "${code}" "GET /storage/signedUrl removed"

code=$(curl_body "${BASE_URL}/check")
assert_status "401" "${code}" "GET /check without token"

echo "All unauthenticated-access checks completed."
