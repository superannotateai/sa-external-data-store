# Developer guide

Technical reference for the SuperAnnotate External Data Store. For setup, env
variables, and API usage see [README.md](./README.md).

## Overview

The service exposes a small HTTP API that:

1. Authenticates the caller's SuperAnnotate token (`AuthSaMiddleware`).
2. Resolves the target item from SuperAnnotate (`PathValidatorMiddleware` → `getItem`),
   deriving the on-disk location from the SA item — never from client-supplied paths.
3. Serves the item's annotation file (`/annotation`) and signed download URLs for
   its raw assets (`/storage`), backed by a pluggable storage repository (LOCAL or S3).

The trust model: **SuperAnnotate is the authorization authority**; this service maps
authorized SA items to storage locations and issues short-lived HMAC capabilities.

## Tech stack

| Area | Choice |
| --- | --- |
| Runtime | Node.js `>= 20` |
| Language | TypeScript (`strict`), compiled with `tsc` |
| HTTP framework | Express 4 |
| Security middleware | `helmet`, `cors` (origin allowlist) |
| Storage | Local filesystem (`fs`) or AWS S3 (`@aws-sdk/client-s3`, `lib-storage`, `s3-request-presigner`) |
| Signing | Node `crypto` HMAC-SHA256 (constant-time compare) |
| Misc | `mime-types`, `dotenv`, `chalk` |
| Tests | Jest + `ts-jest` |
| Dev | `nodemon`, `ts-node` |

## Project structure

```text
src/
  index.ts                      # App bootstrap: helmet, CORS, routes, error + 404 handlers
  middleware/
    authSaMiddleware.ts         # Validates x-sa-access-token via SA getMySAUser
    pathValidatorMiddleware.ts  # Resolves SA item -> saScope + saItemName; perms for /annotation
  routes/
    annotationRouter.ts         # GET/POST /annotation  (read/write annotation file)
    storageRouter.ts            # GET /storage (access map -> signed URLs), GET /storage/fileSigned
    checkRouter.ts              # GET /check (auth + storage connectivity)
  repository/
    index.ts                    # Repository facade; picks backend from DATA_STORE
    localRepository.ts          # Local filesystem backend
    s3Repository.ts             # AWS S3 backend
  utils/
    config.ts                   # Typed env access (Config.*)
    saApi.ts                    # SuperAnnotate API client (getMySAUser, getItem, getAnnotationPermissions)
    pathSafety.ts               # Path jails + single-segment validation
    errorHandler.ts             # sendError() + errorMiddleware()
    s3Sdk.ts                    # Thin S3 SDK wrapper
    functions.ts                # Safe JSON + header parsing helpers
  types/
    request.ts                  # SaAuthorizedRequest, SaInternalRequest
    saApi.ts                    # SaUser, SaItem, SaItemManifest, permissions, responses
    errors.ts                   # AppError, SaApiError, ErrorCode
    config.ts                   # DataStoreType
    index.ts                    # Barrel re-exports
infosec/                        # Security test pack, report, and recommendations
```

Each source folder has a co-located `__tests__/` directory.

## Request lifecycle

```text
Request
  -> helmet + CORS (index.ts)
  -> AuthSaMiddleware            # x-sa-access-token -> SA getMySAUser -> req.saUserId/saAccessToken
  -> PathValidatorMiddleware     # getItem(team,project,folder,item) -> access check + item name
                                 #   /annotation: also getAnnotationPermissions (read GET / write POST)
                                 #   sets req.saScope = "team/project/folder", req.saItemName
  -> route handler               # composes the path, calls repository
  -> errorMiddleware             # AppError -> status/code, else 500
```

`saApi.request()` rejects with a typed `SaApiError(statusCode, body)` on non-2xx upstream
responses. Both middlewares map that status to the right client error (401 for invalid
token, 403 for no access, 500 otherwise) rather than guessing from the body shape.

## Storage model

`LOCAL_STORAGE_PATH` (LOCAL) or `S3_PREFIX` (S3) is the root for a single org. Three logical roots:

```text
<root>/
  files/                                      # raw assets (managed outside this service)
    contract.pdf
  items/
    {teamId}/{projectId}/{folderId}/
      <item_name>_annotation.json             # annotation payload (read/write)
  access_maps/
    {teamId}/{projectId}/<item_name>.json     # owner-curated allowlist: { label, files[], metadata }
```

Key points:

- `<item_name>` is resolved from SuperAnnotate and validated as a single safe path
  segment (`isSafeSegment`). It is never supplied by the client.
- **Annotation** paths are folder-scoped (`items/{team}/{project}/{folder}/...`).
- **Access maps** are project-scoped (`access_maps/{team}/{project}/...`), so they can
  be authored before an item's folder is known. `/storage/` reads the access map and
  signs only the files it declares.
- Raw assets are served from the `files/` root via signed capability URLs.

### Path safety (`utils/pathSafety.ts`)

- `resolveItemsFilePath` / `resolveFilesPath` / `resolveAccessMapsPath` — resolve a
  relative path under a fixed root and return `null` if it escapes the jail.
- `isSafeSegment` — validates a single path segment (rejects separators, `.`/`..`,
  control chars incl. NUL/CR/LF, and length > 255). Applied to SA item names and to
  every access-map `files[]` entry.

## Signed download capability

LOCAL signed URLs are HMAC-SHA256 over `"{filesRelativePath}-{expires}"` using
`LOCAL_SIGN_SECRET_KEY`. Redemption (`GET /storage/fileSigned`):

1. `validateFilesSignature` — recompute HMAC, constant-time compare, check expiry,
   and confirm the path resolves inside the `files/` jail.
2. Stream the file with `X-Content-Type-Options: nosniff` and a **default-deny**
   disposition: only an `INLINE_SAFE_TYPES` allowlist (raster images, audio/video,
   PDF) is served inline; everything else (SVG/HTML/XML/unknown) is forced to
   `application/octet-stream` + `Content-Disposition: attachment`.

The URL base comes from `Config.publicBaseUrl()` (`PUBLIC_PROTOCOL` + `PUBLIC_HOST`),
not the request `Host` header. S3 mode does not implement this HMAC scheme
(`validateFilesSignature` returns `false`; manifest/files operations throw `501`).

## Configuration (`utils/config.ts`)

All environment access goes through the static `Config` class, which throws on missing
required values. Notable behavior:

- `saItemApiHost()` / `saUserApiHost()` and `publicHost()` are **required in production**
  (`NODE_ENV=production`) and fall back to dev defaults otherwise.
- SA hosts are read once at module load in `saApi.ts` (fail-fast on misconfiguration).

## Error handling

- `AppError(message, statusCode, code)` — thrown by app code; formatted by `errorMiddleware`.
- `SaApiError(statusCode, body)` — thrown by the SA client to carry upstream status.
- `sendError(res, status, message, code?)` — single helper for standardized JSON errors.
- `ErrorCode` — stable client codes (e.g. `AUTH_INVALID_TOKEN`, `VALIDATION_INVALID_PATH`).

## Security

The security posture, findings, and remediations are tracked in
[`infosec/SECURITY_REPORT.md`](./infosec/SECURITY_REPORT.md) and
[`infosec/RECOMMENDATIONS.md`](./infosec/RECOMMENDATIONS.md). A runnable probe suite
lives in `infosec/tests/` (`./infosec/scripts/run-all.sh`). Core controls:

- SA-derived paths (no client path input), per-root path jails, single-segment validation.
- HMAC capability URLs (constant-time compare, expiry, files-root jail).
- Origin-allowlisted CORS (`https://*.superannotate.com`), `helmet`, download hardening.

## Testing

```bash
npm test                 # jest
npm run test:coverage
```

Tests are co-located in `__tests__/` folders. Route tests mock the middleware and the
repository facade; middleware tests mock the SA client and `Config`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run with `nodemon` (ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run watch` | TypeScript watch mode |
| `npm test` / `test:watch` / `test:coverage` | Jest |
| `npm run clean` | Remove `dist/` |

## Conventions

- Derive storage locations from SuperAnnotate, never from client input.
- Validate any value used as a path segment with `isSafeSegment`; resolve through a jail helper.
- Return errors via `sendError` / `AppError` with a stable `ErrorCode`.
- Don't log credentials, tokens, full headers, or request bodies.
