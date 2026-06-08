# Security assessment report

**Application:** sa-external-data-store  
**Assessment date:** 2026-06-03  
**Re-validations:** 2026-06-04 (item-manifest redesign), 2026-06-08 (access-map flow + remediations)  
**Assessor role:** Internal offensive review (black-box + source-assisted static analysis)  
**Scope:** API surface in `src/`, default port `3005`, LOCAL and S3 configuration modes  
**Artifacts:** `infosec/` (tests, results, this report)

> **2026-06-08 re-validation summary.** Since the last review the storage flow moved to
> an **owner-curated access map**: `GET /storage/` resolves the item via SuperAnnotate
> (`getItem`) then reads `access_maps/{teamId}/{projectId}/<item_name>.json` (project-scoped)
> and signs only the files it declares. Multiple findings were remediated and verified:
> **INF-004** (secret rotated), **INF-005** (CORS now restricted to `https://*.superannotate.com`),
> **INF-006** (signed-URL host from `PUBLIC_HOST`/`publicBaseUrl`, not the request Host),
> **INF-011** (SA hosts env-driven, prod-required), **INF-012** (typed `SaApiError` → invalid
> token returns **401**, verified live). A regression introduced during the access-map work
> (**INF-013**, debug `console.log`s) was fixed. **INF-007** (security headers + stored-content
> rendering) was then remediated with `helmet`, `x-powered-by` disabled, and a default-deny
> inline/attachment policy on `fileSigned`; **INF-008** (residual logging) was **risk-accepted**.
> All 7 infosec suites pass (`infosec/results/latest`); 101/101 unit tests pass.
> **Open:** INF-009, INF-010 (both Low).
>
> **2026-06-04 re-validation summary.** Storage redesigned to a manifest model:
> `PathValidatorMiddleware` resolves the on-disk location from SuperAnnotate (`getItem`)
> instead of client paths; `/storage/file` and `/storage/signedUrl` removed; `/storage/fileSigned`
> jailed to the `files/` root with a constant-time HMAC capability. Remediated INF-001, INF-002,
> INF-003; INF-008 partially. Tests `01` and `05` updated to the new surface.

---

## Executive summary

The original critical issues (path traversal, S3 signature bypass, `sa-file-path` IDOR) are **remediated**: the storage path is derived from an authoritative SuperAnnotate `getItem` lookup (never from client input), the signable file allowlist comes from an **owner-curated access map**, and `/storage/fileSigned` is a constant-time HMAC capability jailed to the `files/` root. Auth error mapping, CORS, signed-URL host, and SA host configuration have all been hardened and verified.

Remaining risk is **operational hardening**, all Low severity:

1. **No rate limiting (INF-009)** on the unauthenticated `fileSigned` endpoint.
2. **No upload size cap (INF-010)** on `POST /annotation/`.

INF-008 (residual logging) has been **risk-accepted** (Low; no sensitive values logged on any hot path). All other findings are remediated.

Live probes against `http://localhost:3005` confirm: traversal/forged/expired capability requests → `401`; legacy endpoints → `404`; auth gates → `401`; CORS rejects non-`superannotate.com` origins; security headers present and `X-Powered-By` removed. No file-read or auth bypass achieved.

---

## Methodology

| Phase | Activities |
|-------|------------|
| Recon | README, route map, middleware order, env vars |
| Static review | Auth, path resolution, signing, S3/LOCAL repositories, error handling |
| Dynamic probes | Scripts in `infosec/tests/*.sh` against running dev server |
| Regression | Original security-engineer curl PoC + encoding variants |

**Evidence artifacts:** run `./infosec/scripts/run-all.sh` → `infosec/results/latest/*.log`

---

## Attack surface

| Endpoint | Auth | Storage impact |
|----------|------|----------------|
| `GET /health` | None | Info |
| `GET /storage/` | SA token + `getItem` | Reads access map; mints signed URLs for declared files |
| `GET /storage/fileSigned` | HMAC capability (LOCAL), jailed to `files/` | File read |
| `GET/POST /annotation/` | SA token + `getItem` (+ read/write perm) | Read/write `<item>_annotation.json` |
| `GET /check` | SA token | Health + storage connectivity |

Removed in the redesign: `GET /storage/file`, `GET /storage/signedUrl` (now `404`).

---

## Findings

### INF-001 — Path traversal via signed URL (LOCAL) — **Remediated / retest**

| Field | Value |
|-------|--------|
| **Severity** | Critical (pre-fix) → **Low** (retest with jail) |
| **CWE** | CWE-22 (Improper Limitation of a Pathname to a Restricted Directory) |
| **Affected** | `GET /storage/fileSigned`, `LocalRepository.getFilePath` |

**Description:** User-controlled `path` was joined into the filesystem without a jail, allowing `../` chains to read arbitrary local files if the HMAC was valid.

**Current controls:** `resolveItemsFilePath` / `assertSafeRelativeItemsPath` in `src/utils/pathSafety.ts`; checks in `localRepository`, `storageRouter`, and `pathValidatorMiddleware`.

**Current controls (2026-06-08):** signed downloads are jailed to the `files/` root via `resolveFilesPath`; `validateFilesSignature` returns `false` for any path that escapes the jail (→ `401`). The `items/` and `access_maps/` roots are jailed separately, and the SA item name + every access-map `files[]` entry must pass `isSafeSegment`.

**Dynamic retest (2026-06-08):** PoC with `../../../../../../etc/passwd` + forged/expired/garbage signatures all return **HTTP 401** — never `200` with file content.

---

### INF-002 — `/storage/fileSigned` signature bypass in S3 mode — **Remediated (2026-06-04)**

| Field | Value |
|-------|--------|
| **Severity** | High (pre-fix) → **Low** (retest) |
| **CWE** | CWE-306 (Missing Authentication for Critical Function) |
| **Location** | `src/repository/s3Repository.ts`, `src/routes/storageRouter.ts` |

**Description (original):** In S3 mode, any request to `/storage/fileSigned` with arbitrary `path/expires/signature` passed validation because `validateSignature` returned `true`.

**Fix:** `/storage/fileSigned` now calls `validateFilesSignature`, which is **not** the always-true method. In S3 mode `S3Repository.validateFilesSignature` returns `false` (no HMAC scheme), so redemption yields `401`. The old always-true `validateSignature` is no longer exposed by the repository facade, so it is unreachable from any route. The manifest/files flow throws `501 NOT_SUPPORTED` under S3.

**Residual:** If S3 needs signed delivery, wire it to AWS presigned URLs from `getSignedUrl`; do not re-expose `validateSignature`.

---

### INF-003 — IDOR via `sa-file-path` header — **Remediated (2026-06-04)**

| Field | Value |
|-------|--------|
| **Severity** | High (pre-fix) → **Low** (retest) |
| **CWE** | CWE-639 (Authorization Bypass Through User-Controlled Key) |
| **Location** | `src/middleware/pathValidatorMiddleware.ts` |

**Description (original):** The `sa-file-path` branch built a storage path from a client-supplied string after only validating token identity — no per-resource authorization.

**Fix:** The `sa-file-path` branch was **removed**. All routes now require `team/project/folder/item` and resolve the on-disk location from an authoritative SuperAnnotate `getItem` call (which 4xx's for items the caller cannot access). The resolved item name is validated as a single safe segment (`isSafeSegment`) before being used as a path component. The client can no longer supply or influence the path.

**Retest:** `infosec/tests/05-header-and-input-fuzz.sh` confirms the legacy header is ignored and malformed IDs never return `200`.

---

### INF-004 — Weak / default signing secret — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | Critical (pre-fix) → **Low** (retest) |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |

**Description:** LOCAL signed URLs are only as strong as `LOCAL_SIGN_SECRET_KEY`; the README example was `your-sign-secret`.

**Fix:** Secret rotated to a long random value (kept in `.env`, which is gitignored and untracked). Live PoC with the README default secret is rejected (`401`). Operational reminder: rotate again if it is ever exposed; never use the README placeholder in any environment.

---

### INF-005 — Permissive CORS — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | Medium (pre-fix) → **Low** (retest) |
| **CWE** | CWE-942 (Overly Permissive CORS) |
| **Location** | `src/index.ts` |

**Description (original):** `app.use(cors())` reflected `Access-Control-Allow-Origin: *`.

**Fix:** CORS restricted to `https://*.superannotate.com` via an anchored regex origin callback (`/^https:\/\/([a-z0-9-]+\.)+superannotate\.com$/i`). HTTPS is required; suffix (`...superannotate.com.attacker.com`) and prefix (`evilsuperannotate.com`) bypasses are blocked.

**Live retest:** allowed origins reflected; `https://evil.example`, `https://app.superannotate.com.evil.com`, `https://evilsuperannotate.com`, and `http://app.superannotate.com` all receive **no** `Access-Control-Allow-Origin`.

**Note:** CORS is browser-enforced only; it is not an authorization control. Server-side/`curl` clients are unaffected (auth remains `AuthSaMiddleware` + `getItem`).

---

### INF-006 — Host header trust for signed URL generation — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | Medium (pre-fix) → **Low** (retest) |
| **CWE** | CWE-601 (URL Redirection to Untrusted Site) |
| **Location** | `src/routes/storageRouter.ts`, `src/utils/config.ts` |

**Description (original):** Signed URLs embedded the client-influenced request host (`req.get('host')`), so a hostile `Host`/`X-Forwarded-Host` could mint a validly-signed URL pointing at an attacker domain.

**Fix:** `GET /storage/` now builds the prefix from `Config.publicBaseUrl()` = `PUBLIC_PROTOCOL` + `PUBLIC_HOST` (env-driven, **required in production**, dev fallback to `localhost:PORT`). The request `Host` header is no longer used for URL generation.

---

### INF-007 — Missing security headers / stored-content rendering — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | Low–Medium (pre-fix) → **Low** (retest) |
| **CWE** | CWE-693 (Protection Mechanism Failure), CWE-79 (stored XSS via file render) |
| **Location** | `src/index.ts`, `src/routes/storageRouter.ts`, `src/utils/pathSafety.ts` |

**Description (original):** `X-Powered-By: Express` exposed; no baseline security headers; and the file-download path served assets with an extension-derived MIME and no `nosniff`/`Content-Disposition`, so a stored HTML/SVG asset could render and execute same-origin.

**Fix:**
- `app.disable('x-powered-by')` + `helmet()` (CSP off — JSON/file API; `Cross-Origin-Resource-Policy: cross-origin` so the SA web app can embed assets; COEP off). Adds `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, HSTS.
- `GET /storage/fileSigned` now always sends `X-Content-Type-Options: nosniff` and applies a **default-deny inline policy**: only an `INLINE_SAFE_TYPES` allowlist (raster images, audio/video, PDF) is served inline with its real type; everything else — including `image/svg+xml`, `text/html`, XML, and unknown types — is forced to `application/octet-stream` + `Content-Disposition: attachment`. SDK byte-fetch is unaffected (disposition only changes browser rendering).
- `isSafeSegment` now rejects control characters (`\x00–\x1f`, `\x7f`), closing a CR/LF header-injection vector if a name is ever reflected into a header.

**Live retest (2026-06-08):** `/health` returns `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: cross-origin`, HSTS; no `X-Powered-By`. Unit tests assert SVG/HTML/XML/unknown → `octet-stream` + `attachment`, PDF → inline + `nosniff`.

**Residual:** No CSP/sandboxing on inline responses (raster/AV/PDF only, which don't execute author script). If inline SVG/HTML preview is ever required, add a strict CSP or a separate sandbox content origin.

---

### INF-008 — Sensitive operational logging — **Risk accepted (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | **Low** |
| **CWE** | CWE-532 (Insertion of Sensitive Information into Log File) |
| **Decision** | Owner-accepted as-is on 2026-06-08 |

**Fixed:** All high-signal/sensitive logs removed — path/item/perms/token/chunk `console.log`s from `pathValidatorMiddleware.ts`, `localRepository.ts`, `annotationRouter.ts`, `storageRouter.ts`, plus the INF-013 debug-log regression in `pathSafety.ts`.

**Accepted residual (no fix planned):**

- `src/index.ts` — dev request logger (`${method} ${path}`), gated behind `NODE_ENV !== "production"` (paths only, no tokens/bodies).
- `src/utils/errorHandler.ts` — `console.error("Unhandled error:", err)`.
- `src/routes/checkRouter.ts`, `src/utils/s3Sdk.ts` — infra error logging (no user/token data).

**Rationale:** the remaining calls log no credentials or user-controlled sensitive values on any hot path; severity is Low. **Conditions of acceptance:** prod must set `NODE_ENV=production`; no middleware may log full headers/requests (the earlier dev token capture must not recur). Revisit if a structured/redacting logger is introduced.

---

### INF-009 — No rate limiting on public fileSigned — **Open**

| Field | Value |
|-------|--------|
| **Severity** | **Low** |
| **CWE** | CWE-770 |

**Description:** Unauthenticated endpoint allows unlimited HMAC verification and file existence checks → brute-force / enumeration aid.

---

### INF-010 — Upload size / DoS on POST /annotation — **Open**

| Field | Value |
|-------|--------|
| **Severity** | **Low** |
| **CWE** | CWE-400 |

**Description:** Request body streamed to disk/S3 without documented `limit` middleware; large uploads may exhaust disk or incur S3 cost.

---

### INF-011 — Hard-coded dev SuperAnnotate API hosts — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | High (trust anchor) → **Low** (retest) |
| **Location** | `src/utils/saApi.ts`, `src/utils/config.ts` |

**Description:** SA hosts (the authN/authZ trust anchor) were hard-coded to the dev environment.

**Fix:** Hosts resolved from `SA_ITEM_API_HOST` / `SA_USER_API_HOST` via `Config`, **required in production** (throws if unset), with a non-prod default. Resolved once at process start in `saApi.ts` (fail-fast on misconfiguration).

---

### INF-012 — Invalid token returns HTTP 500 — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | **Low** |
| **CWE** | CWE-755 |

**Description (original):** Invalid/expired tokens surfaced as `500` because `SuperAnnotateApi.request` discarded the upstream HTTP status, leaving callers to guess from body shape.

**Fix:** `request` now rejects with a typed `SaApiError(statusCode, body)`. `AuthSaMiddleware` and `PathValidatorMiddleware` map on status: `401/403` → 401, other/transport → 500. **Live retest:** invalid token on `/annotation/` and `/storage/` → **401**.

---

### INF-013 — Debug logging reintroduced in access-map work — **Remediated (2026-06-08)**

| Field | Value |
|-------|--------|
| **Severity** | **Low–Medium** |
| **CWE** | CWE-532 (Insertion of Sensitive Information into Log File) |
| **Location** | `src/utils/pathSafety.ts`, `src/routes/annotationRouter.ts` |

**Description:** The access-map change reintroduced `console.log` statements that logged rejected path segments (attacker-influenced item names / manifest entries) and resolved annotation file paths on the hot path.

**Fix:** Debug `console.log`s removed (verified by owner).

---

## Original PoC status

```bash
# Security engineer PoC (LOCAL + known secret)
P='../../../../../../etc/passwd'
# ... openssl HMAC ...
curl -i "http://localhost:3005/storage/fileSigned?path=...&expires=...&signature=..."
```

| Environment observed | Result |
|---------------------|--------|
| Local dev (2026-06-03) | **401** `INVALID_SIGNATURE` (custom secret) — no file leak |
| Local dev (2026-06-08) | **401** for traversal + forged/expired/garbage signatures — no file leak |
| With files-jail + matching secret | Path rejected by `validateFilesSignature` → **401**; never escapes `files/` |

---

## Severity summary

| ID | Title | Status (2026-06-08) | Severity |
|----|-------|--------|----------|
| INF-001 | Path traversal (LOCAL fileSigned) | **Remediated** | Low (retest) |
| INF-002 | S3 fileSigned signature bypass | **Remediated** | Low (retest) |
| INF-003 | IDOR sa-file-path | **Remediated** | Low (retest) |
| INF-004 | Signing secret strength | **Remediated** | Low (retest) |
| INF-005 | Permissive CORS | **Remediated** | Low (retest) |
| INF-006 | Host header in signed URLs | **Remediated** | Low (retest) |
| INF-007 | Missing security headers / stored-content rendering | **Remediated** | Low (retest) |
| INF-008 | Sensitive logging (residual) | **Risk accepted** | Low |
| INF-009 | No rate limit fileSigned | Open | Low |
| INF-010 | Upload DoS (annotation POST) | Open | Low |
| INF-011 | Hard-coded SA dev hosts | **Remediated** | Low (retest) |
| INF-012 | Invalid token → 500 (auth middleware) | **Remediated** | Low (retest) |
| INF-013 | Debug logging reintroduced (access-map work) | **Remediated** | Low |

**Open items:** INF-009, INF-010 — both Low. INF-008 risk-accepted.

---

## Suggested verification cadence

1. Run `./infosec/scripts/run-all.sh` on every release candidate (latest run: 0 failures, 2026-06-08).
2. Add a CI job that runs `07-static-path-safety.sh` (no server required).
3. Extend `05-header-and-input-fuzz.sh` with a **valid** `SA_ACCESS_TOKEN` (from a CI secret) for true authorized-access regression tests against the access-map flow.
4. Verify production sets `NODE_ENV=production`, `SA_ITEM_API_HOST`/`SA_USER_API_HOST`, and `PUBLIC_HOST`/`PUBLIC_PROTOCOL` (all required/fail-fast in prod).

---

## References

- Application README — `LOCAL_SIGN_SECRET_KEY`, endpoint table
- Prior internal review — path traversal PoC
- Test pack — `infosec/tests/`
