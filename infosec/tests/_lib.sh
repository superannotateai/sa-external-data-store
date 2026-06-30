#!/usr/bin/env bash
# Shared helpers for infosec test scripts.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3005}"
LOCAL_SIGN_SECRET_KEY="${LOCAL_SIGN_SECRET_KEY:-your-sign-secret}"

assert_status() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "ASSERT FAIL: ${label} expected HTTP ${expected}, got ${actual}"
    return 1
  fi
  echo "OK: ${label} -> HTTP ${actual}"
}

assert_status_in() {
  local label="$1"
  local actual="$2"
  shift 2
  for expected in "$@"; do
    if [[ "${actual}" == "${expected}" ]]; then
      echo "OK: ${label} -> HTTP ${actual} (accepted)"
      return 0
    fi
  done
  echo "ASSERT FAIL: ${label} got HTTP ${actual}, expected one of: $*"
  return 1
}

curl_body() {
  curl -sS -o /tmp/infosec_body.json -w "%{http_code}" "$@"
}

sign_local_path() {
  local p="$1"
  local expires="$2"
  printf '%s' "${p}-${expires}" | openssl dgst -sha256 -hmac "${LOCAL_SIGN_SECRET_KEY}" | sed 's/^.*= //'
}

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

body_contains() {
  local needle="$1"
  grep -q "${needle}" /tmp/infosec_body.json
}
