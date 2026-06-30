#!/usr/bin/env bash
# Static path-jail verification against application pathSafety module (read-only import).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

npx ts-node --transpile-only "${ROOT}/infosec/tests/static-path-safety-runner.ts"
echo "Static path safety module verification completed."
