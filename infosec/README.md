# Security assessment — sa-external-data-store

Offensive security tests and reports for this service. **Does not modify application source** under `src/`.

## Contents

| Path | Purpose |
|------|---------|
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) | Executive summary, findings, severity, evidence |
| [RECOMMENDATIONS.md](./RECOMMENDATIONS.md) | Prioritized remediation backlog |
| [tests/](./tests/) | Runnable probes (shell + static analysis) |
| [scripts/run-all.sh](./scripts/run-all.sh) | Run all tests and write `results/` artifacts |

## Prerequisites

- Application running locally (default `http://localhost:3005`)
- For signed-URL tests: `LOCAL_SIGN_SECRET_KEY` exported if not using README default
- `curl`, `openssl`, `python3`, `node`, `npx ts-node`

## Quick start

```bash
# From repo root
export BASE_URL="${BASE_URL:-http://localhost:3005}"
export LOCAL_SIGN_SECRET_KEY="${LOCAL_SIGN_SECRET_KEY:-your-sign-secret}"

chmod +x infosec/scripts/run-all.sh infosec/tests/*.sh
./infosec/scripts/run-all.sh
```

Results land in `infosec/results/` (gitignored).

## Scope

- Unauthenticated: `/health`, `/storage/fileSigned`
- Authenticated (requires valid `x-sa-access-token`): `/annotation`, `/storage/file`, `/storage/signedUrl`, `/check`
- Static review of auth, path handling, S3/LOCAL backends, CORS, logging

## Out of scope (unless you extend)

- AWS account / bucket IAM review
- SuperAnnotate API penetration
- Load / DoS at scale
- Supply chain / dependency CVE audit (run `npm audit` separately)

## Responsible use

Run only against environments you own or are authorized to test. Do not commit tokens or secrets into this folder.
