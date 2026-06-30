# Security recommendations (prioritized)

Backlog from the 2026-06-03 assessment, re-validated 2026-06-04 (manifest redesign)
and 2026-06-08 (access-map flow + remediations). See [SECURITY_REPORT.md](./SECURITY_REPORT.md) for evidence and severity.

---

## Done (verified)

- ~~**Path traversal jail (INF-001)**~~ — `items/`, `files/`, `access_maps/` roots jailed; capability HMAC compared in constant time.
- ~~**S3 `/storage/fileSigned` bypass (INF-002)**~~ — uses `validateFilesSignature` (`false` in S3); always-true `validateSignature` unreachable; manifest/files flow `501` under S3.
- ~~**IDOR `sa-file-path` (INF-003)**~~ — header branch removed; path derived from authoritative `getItem`; item name validated as a safe segment.
- ~~**Signing secret (INF-004)**~~ — rotated to a long random value; `.env` gitignored/untracked.
- ~~**CORS (INF-005)**~~ — restricted to `https://*.superannotate.com` via anchored regex; verified live (suffix/prefix/HTTP bypasses blocked).
- ~~**Signed-URL host (INF-006)**~~ — built from `PUBLIC_HOST`/`PUBLIC_PROTOCOL` (`Config.publicBaseUrl()`); request `Host` no longer trusted.
- ~~**SA host config (INF-011)**~~ — env-driven (`SA_ITEM_API_HOST`/`SA_USER_API_HOST`), required in prod, resolved once at startup.
- ~~**Invalid token → 401 (INF-012)**~~ — typed `SaApiError` carries status; both middlewares map on status; verified live.
- ~~**Debug logging regression (INF-013)**~~ — `console.log`s removed from `pathSafety.ts` / `annotationRouter.ts`.
- ~~**Security headers + download hardening (INF-007)**~~ — `helmet()` + `app.disable('x-powered-by')`; `fileSigned` always `nosniff` with a default-deny inline/attachment policy (SVG/HTML/unknown → octet-stream + attachment); `isSafeSegment` rejects control chars. Verified live + unit tests.

## Accepted (no fix planned)

- **Residual logging (INF-008)** — Low; remaining `console.*` calls log no credentials/user-controlled values on any hot path. Conditions: prod sets `NODE_ENV=production`; never log full headers/requests. Revisit if a structured logger is adopted.

---

## P0 — Do immediately

_None outstanding._ (Production config must still set `NODE_ENV=production`, `SA_*_API_HOST`, `PUBLIC_HOST`/`PUBLIC_PROTOCOL` — all fail-fast if missing.)

---

## P1 — Next sprint (all remaining items are Low severity)

1. **Rate limiting (INF-009)** — `express-rate-limit` on `/storage/fileSigned` (and auth endpoints) per IP.
2. **Upload cap (INF-010)** — streaming size limit on `POST /annotation/`.

---

## P2 — Hardening

5. **Clock skew** — allow small negative skew on `expires`; document/short max TTL for capability URLs.
6. **Access-map uniqueness** — confirm SA item names are unique per project (access maps are keyed `{team}/{project}/<name>`); collisions would share an allowlist.

---

## P3 — Process & assurance

7. **Add regression tests** mirroring `infosec/tests/02-path-traversal-fileSigned.sh` to the Jest suite (partly covered by `pathSafety.test.ts`).
8. **Secrets scanning** — gitleaks in CI; block README placeholder secrets in deploy templates.
9. **Dependency audit** — `npm audit` in CI, fail on high/critical.
10. **Threat model doc** — trust boundaries: SA IdP, this service, local disk / S3, public exposure.
11. **Authorized regression test** — `SA_ACCESS_TOKEN` from a CI secret to exercise the access-map happy path.

---

## Deployment checklist

- [ ] `NODE_ENV=production` set (gates dev request logger + dev host fallbacks)
- [ ] `SA_ITEM_API_HOST` / `SA_USER_API_HOST` set to prod SuperAnnotate
- [ ] `PUBLIC_HOST` / `PUBLIC_PROTOCOL` set (signed-URL prefix)
- [ ] `DATA_STORE` intentional for environment
- [ ] `LOCAL_SIGN_SECRET_KEY` rotated and in a secret manager
- [ ] `LOCAL_STORAGE_PATH` permissions minimal (service user only)
- [ ] Service not exposed publicly without API gateway auth / WAF
- [ ] Logs do not contain `x-sa-access-token`
- [ ] `./infosec/scripts/run-all.sh` passes on staging RC

---

## Remaining quick wins (&lt; 1 day effort)

| Item | Effort | Impact |
|------|--------|--------|
| `express-rate-limit` on `fileSigned` (INF-009) | Small | Low |
| Body-size cap on `POST /annotation/` (INF-010) | Small | Low |
