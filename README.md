# SuperAnnotate External Data Store

A Node.js/Express API service for storing and serving files for SuperAnnotate workflows, backed by either AWS S3 or local filesystem storage.

## Features

- Stream-based upload and download endpoints
- Pluggable storage backend (`S3` or `LOCAL`)
- SuperAnnotate token validation for protected endpoints
- File path resolution via SA headers (`team`, `project`, optional `folder`/`item`, or explicit file path)
- Signed URL generation (`/storage/signedUrl`) and signed access endpoint (`/storage/fileSigned`)
- Standardized JSON error responses
- TypeScript + Jest unit tests

## Prerequisites

- Node.js `>= 20`
- npm
- SuperAnnotate access token support
- For S3 mode: AWS credentials + bucket

## Installation

```bash
git clone <repository-url>
cd sa-external-data-store
npm install
```

## Environment Variables

### Common

```env
PORT=3005
DATA_STORE=S3 # or LOCAL
```

### S3 backend (`DATA_STORE=S3`)

```env
S3_BUCKET_NAME=your-bucket
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_REGION=us-east-1
S3_PREFIX=items
```

### Local backend (`DATA_STORE=LOCAL`)

```env
LOCAL_STORAGE_PATH=/absolute/path/to/storage
LOCAL_SIGN_SECRET_KEY=your-sign-secret
SIGN_URL_EXPIRATION_TIME_HR=24
```

## Run

```bash
npm run dev
```

Build + start:

```bash
npm run build
npm start
```

## Test

```bash
npm test
```

Coverage:

```bash
npm run test:coverage
```

## API Overview

Base routes:

- `/annotation` for annotation stream upload/download
- `/storage` for file download and signed URL operations

Health:

- `GET /health` -> `{ "message": "OK" }`

### Authentication and Header Rules

Protected routes use `AuthSaMiddleware` and require:

- `x-sa-access-token`: SA access token

Path resolution uses `PathValidatorMiddleware` and requires:

- `sa-team-id`
- `sa-project-id`
- One of:
  - `sa-file-path`, or
  - `sa-folder-id` + `sa-item-id` (resolved to `.../annotation.json`)

### Endpoints

| Method | Path | Protected | Description |
| --- | --- | --- | --- |
| GET | `/health` | No | Health check |
| GET | `/annotation/` | Yes | Stream file content resolved from SA headers |
| POST | `/annotation/` | Yes | Save request stream to resolved file path |
| GET | `/storage/file` | Yes | Download file stream for resolved file path |
| GET | `/storage/signedUrl` | Yes | Get signed URL for resolved file path |
| GET | `/storage/fileSigned` | No | Download file via query signature validation |

### `GET /annotation/`

Downloads a stream from repository path resolved by middleware.

Returns:

- `200` stream response
- `404` when not found
- `400/401/500` standardized error JSON

### `POST /annotation/`

Uploads request body stream to repository path resolved by middleware.

Success response:

```json
{
  "message": "Data stream saved successfully",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

### `GET /storage/file`

Protected file streaming route. Uses resolved `saFilePath` and returns file stream with MIME type.

### `GET /storage/signedUrl`

Protected route that returns:

```json
{
  "signedUrl": "..."
}
```

Backend behavior:

- `S3`: returns AWS presigned URL
- `LOCAL`: returns app URL with signed query params targeting `/storage/fileSigned`

### `GET /storage/fileSigned`

Query params:

- `path`
- `expires`
- `signature`

Behavior:

- validates signature via repository (`validateSignature`)
- validates file existence
- streams file if valid

## Example Requests

Get annotation stream:

```bash
curl -X GET "http://localhost:3005/annotation/" \
  -H "x-sa-access-token: Bearer <token>" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4"
```

Upload annotation stream:

```bash
curl -X POST "http://localhost:3005/annotation/" \
  -H "x-sa-access-token: Bearer <token>" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@annotation.json"
```

Get signed URL:

```bash
curl -X GET "http://localhost:3005/storage/signedUrl" \
  -H "x-sa-access-token: Bearer <token>" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-file-path: 1/2/custom/path/file.pdf"
```

## Error Response Format

All handled errors return:

```json
{
  "error": "Bad Request",
  "message": "Human-readable message",
  "code": "OPTIONAL_STABLE_CODE",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

## Project Structure

```text
src/
  index.ts
  middleware/
    authSaMiddleware.ts
    pathValidatorMiddleware.ts
  routes/
    annotationRouter.ts
    storageRouter.ts
  repository/
    index.ts
    localRepository.ts
    s3Repository.ts
  utils/
    config.ts
    errorHandler.ts
    functions.ts
    s3Sdk.ts
    saApi.ts
  types/
    request.ts
    saApi.ts
    errors.ts
    config.ts
```

## Scripts

- `npm run dev` - run with nodemon
- `npm run build` - compile TypeScript
- `npm start` - run compiled output
- `npm run watch` - TypeScript watch mode
- `npm test` - run tests
- `npm run test:watch` - run tests in watch mode
- `npm run test:coverage` - coverage report
- `npm run clean` - remove `dist/`

## License

ISC
