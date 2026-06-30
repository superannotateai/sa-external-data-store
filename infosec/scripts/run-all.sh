#!/usr/bin/env bash
# Run all infosec probes and aggregate output.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFOSEC="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS="${INFOSEC}/results"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${RESULTS}/run-${TS}"
BASE_URL="${BASE_URL:-http://localhost:3005}"

mkdir -p "${OUT}"
export BASE_URL
export LOCAL_SIGN_SECRET_KEY="${LOCAL_SIGN_SECRET_KEY:-your-sign-secret}"

echo "Infosec run ${TS}" | tee "${OUT}/summary.txt"
echo "BASE_URL=${BASE_URL}" | tee -a "${OUT}/summary.txt"
echo "" | tee -a "${OUT}/summary.txt"

run_test() {
  local name="$1"
  local script="$2"
  echo "=== ${name} ===" | tee -a "${OUT}/summary.txt"
  if bash "${script}" > "${OUT}/${name}.log" 2>&1; then
    echo "PASS ${name}" | tee -a "${OUT}/summary.txt"
    return 0
  else
    echo "FAIL ${name} (see ${name}.log)" | tee -a "${OUT}/summary.txt"
    return 1
  fi
}

FAILURES=0
run_test "01-unauthenticated-access" "${INFOSEC}/tests/01-unauthenticated-access.sh" || FAILURES=$((FAILURES + 1))
run_test "02-path-traversal-fileSigned" "${INFOSEC}/tests/02-path-traversal-fileSigned.sh" || FAILURES=$((FAILURES + 1))
run_test "03-signature-abuse" "${INFOSEC}/tests/03-signature-abuse.sh" || FAILURES=$((FAILURES + 1))
run_test "04-auth-bypass-probes" "${INFOSEC}/tests/04-auth-bypass-probes.sh" || FAILURES=$((FAILURES + 1))
run_test "05-header-and-input-fuzz" "${INFOSEC}/tests/05-header-and-input-fuzz.sh" || FAILURES=$((FAILURES + 1))
run_test "06-cors-and-metadata" "${INFOSEC}/tests/06-cors-and-metadata.sh" || FAILURES=$((FAILURES + 1))
run_test "07-static-path-safety" "${INFOSEC}/tests/07-static-path-safety.sh" || FAILURES=$((FAILURES + 1))

echo "" | tee -a "${OUT}/summary.txt"
echo "Finished. Failures: ${FAILURES}" | tee -a "${OUT}/summary.txt"
echo "Latest symlink: ${RESULTS}/latest -> ${OUT}"
ln -sfn "${OUT}" "${RESULTS}/latest"

exit "${FAILURES}"
