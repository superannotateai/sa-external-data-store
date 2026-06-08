# SuperAnnotate External Data Store

A Node.js/Express service that stores and serves files for SuperAnnotate workflows,
backed by either the local filesystem or AWS S3. Access is authorized against
SuperAnnotate, and raw assets are delivered through short-lived signed URLs.

> Looking for architecture, internals, or contribution details? See [DEVELOPER.md](./DEVELOPER.md).

## What it does

- Authenticates every request with a SuperAnnotate access token.
- Resolves the requested item from SuperAnnotate (so file locations are never taken from client input).
- Serves an item's **annotation** file (read/write) and signed **download URLs** for the item's raw assets.
- Decides which raw assets an item may expose using an owner-curated **access map** (see [Creating access maps](#creating-access-maps)).

## Prerequisites

- Node.js `>= 20` and npm
- A SuperAnnotate access token (for calling the API)
- For S3 mode: AWS credentials and a bucket

## Installation

```bash
git clone <repository-url>
cd sa-external-data-store
npm install
```

## Configuration (environment variables)

Configuration is read from environment variables (a local `.env` file is supported via `dotenv`).

### Common

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3005` | Port the server listens on |
| `NODE_ENV` | In prod | – | Set to `production` in production. Enables fail-fast config and disables dev request logging |
| `DATA_STORE` | Yes | – | Storage backend: `LOCAL` or `S3` |
| `SA_ITEM_API_HOST` | In prod | `item.superannotate.com`* | SuperAnnotate item API host |
| `SA_USER_API_HOST` | In prod | `api.superannotate.com`* | SuperAnnotate user API host |
| `PUBLIC_PROTOCOL` | No | `http` | Protocol used when building signed URLs (`https` behind TLS) |
| `PUBLIC_HOST` | In prod | `localhost:<PORT>`* | Public host[:port] used when building signed URLs |

\* The defaults apply only when `NODE_ENV` is not `production`. In production these variables are **required** and the server fails to start if they are missing.

### LOCAL backend (`DATA_STORE=LOCAL`)

| Variable | Required | Description |
| --- | --- | --- |
| `LOCAL_STORAGE_PATH` | Yes | Absolute path to the storage root for this org |
| `LOCAL_SIGN_SECRET_KEY` | Yes | Secret used to sign download URLs. Use a long, random value — never a placeholder |
| `SIGN_URL_EXPIRATION_TIME_HR` | Yes | Signed URL lifetime, in hours |

### S3 backend (`DATA_STORE=S3`)

| Variable | Required | Description |
| --- | --- | --- |
| `S3_BUCKET_NAME` | Yes | Target bucket |
| `S3_ACCESS_KEY_ID` | Yes | AWS access key ID |
| `S3_SECRET_ACCESS_KEY` | Yes | AWS secret access key |
| `S3_REGION` | Yes | AWS region (e.g. `us-east-1`) |
| `S3_PREFIX` | Yes | Key prefix (e.g. `items`) |

Example `.env` for local development:

```env
PORT=3005
DATA_STORE=LOCAL
LOCAL_STORAGE_PATH=/absolute/path/to/storage
LOCAL_SIGN_SECRET_KEY=replace-with-a-long-random-secret
SIGN_URL_EXPIRATION_TIME_HR=1
PUBLIC_PROTOCOL=http
PUBLIC_HOST=localhost:3005
```

## Running the server

Development (auto-reload):

```bash
npm run dev
```

Production (compile, then run):

```bash
npm run build
npm start
```

Verify it's up:

```bash
curl http://localhost:3005/health
# { "message": "OK" }
```

## Using the API

All endpoints except `/health` require a SuperAnnotate access token. Item-scoped
endpoints also require the team/project/folder/item headers; the service resolves
the actual file location from SuperAnnotate.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | No | Health check |
| GET | `/check` | Yes | Verifies SuperAnnotate auth + storage connectivity |
| GET | `/annotation/` | Yes | Download the item's annotation file |
| POST | `/annotation/` | Yes | Upload/replace the item's annotation file |
| GET | `/storage/` | Yes | Return signed download URLs for the item's access-map files |
| GET | `/storage/fileSigned` | Signed URL | Download a raw asset via a signed URL |

Required headers for item-scoped endpoints:

- `x-sa-access-token` — SuperAnnotate access token
- `sa-team-id`, `sa-project-id`, `sa-folder-id`, `sa-item-id`

### Examples

Download an annotation:

```bash
curl -X GET "http://localhost:3005/annotation/" \
  -H "x-sa-access-token: <token>" \
  -H "sa-team-id: 1" -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" -H "sa-item-id: 4"
```

Upload an annotation:

```bash
curl -X POST "http://localhost:3005/annotation/" \
  -H "x-sa-access-token: <token>" \
  -H "sa-team-id: 1" -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" -H "sa-item-id: 4" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@annotation.json"
```

Get signed URLs for an item's files, then download one:

```bash
curl -X GET "http://localhost:3005/storage/" \
  -H "x-sa-access-token: <token>" \
  -H "sa-team-id: 1" -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" -H "sa-item-id: 4"
# -> { "label": "...", "files": { "contract.pdf": "<signed url>" }, "metadata": {} }

curl -L "<signed url>" -o contract.pdf
```

Errors are returned as standardized JSON:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired authorization token",
  "code": "AUTH_INVALID_TOKEN",
  "timestamp": "2026-02-26T12:00:00.000Z"
}
```

## Creating access maps

> **Placeholder — to be completed.**
>
> An *access map* is an owner-curated JSON file that declares which raw assets an
> item is allowed to expose for download. The `/storage/` endpoint reads it to
> decide which files to sign.
>
> - Location: `{LOCAL_STORAGE_PATH}/access_maps/{teamId}/{projectId}/<item_name>.json`
> - Shape:
>
> ```json
> {
>   "label": "Human-readable label",
>   "files": ["fileName1.pdf", "fileName2.png"],
>   "metadata": {}
> }
> ```
>
> Raw assets themselves live under `{LOCAL_STORAGE_PATH}/files/`.
>
> _Detailed authoring guidance (naming rules, how `<item_name>` maps to SuperAnnotate
> items, examples, and validation) will be added here later._

## Testing

```bash
npm test            # run unit tests
npm run test:coverage
```

## License

ISC
