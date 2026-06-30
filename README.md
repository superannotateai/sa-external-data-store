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

## Local storage folder structure

When `DATA_STORE=LOCAL`, the service reads and writes everything under a single
storage root.

1. Create the storage folder in the **root of this project** (e.g. `local_storage/`).
2. Point `LOCAL_STORAGE_PATH` at it using an **absolute path**:

   ```env
   LOCAL_STORAGE_PATH=/absolute/path/to/sa-external-data-store/local_storage
   ```

Inside `LOCAL_STORAGE_PATH` there are up to three folders:

```text
{LOCAL_STORAGE_PATH}/
  files/         # input assets (optional)
  access_maps/   # download access rules (optional)
  items/         # annotations (created automatically)
```

> `files/` and `access_maps/` are **optional** — they are only needed when items
> have input assets (images, videos, PDFs, etc.) that should be downloadable.
> A project that only stores annotations needs just `items/` (auto-created).

### `files/` — input assets

Stores the raw input files served for download. Lay them out however you like;
nested subfolders are allowed (e.g. `files/images/image_1.jpg`). **Symlinks are
supported**, so large datasets can live elsewhere and be linked in.

```text
files/
  contract.pdf
  images/
    image_1.jpg
    image_2.jpg
```

Files are never listed directly — an asset is only downloadable if an access map
references it (see below).

### `access_maps/` — download access rules

An *access map* is a JSON file that declares which `files/` assets a given item is
allowed to expose. `GET /storage/` reads it and returns a signed download URL for
each listed file.

**Location**

```text
access_maps/<team_id>/<project_id>/<item_name>.json
```

- Scoped by **team and project only** — intentionally independent of the
  SuperAnnotate folder.
- The file name must match the **item name** (without extension), e.g. an item
  named `test_00001` → `access_maps/<team_id>/<project_id>/test_00001.json`.
- Because the path has no folder component, **items with the same name share the
  same access rule**, even if they live in different SuperAnnotate folders.

**File format**

```json
{
  "label": "test_00001",
  "files": ["images/image_1.jpg"],
  "metadata": {}
}
```

- `label` — human-readable label (free-form).
- `files` — the **allowlist**: relative paths under `files/`. Only files listed
  here can ever be signed/downloaded for this item. Nested paths are allowed
  (e.g. `images/image_1.jpg`); `..`, absolute paths, and control characters are rejected.
- `metadata` — arbitrary JSON, returned as-is to the caller.

**Access logic (how a download is authorized)**

1. The caller hits `GET /storage/` with their SA token and `sa-team-id`,
   `sa-project-id`, `sa-folder-id`, `sa-item-id`.
2. The service resolves the item from SuperAnnotate (`getItem`) — this is the
   authorization check and also yields the item **name**.
3. It reads `access_maps/<team_id>/<project_id>/<item_name>.json`.
4. For each entry in `files`, it returns a short-lived signed URL pointing at
   `GET /storage/fileSigned`.
5. `404 NOT_FOUND_MANIFEST` is returned if no access map exists for the item.

### `items/` — annotations (auto-managed)

Annotation files are created and updated automatically by the service; you do not
create these by hand.

**Storage path**

```text
items/<team_id>/<project_id>/<folder_id>/<item_name>_annotation.json
```

- Folder-scoped (unlike access maps), because annotations belong to a specific
  SuperAnnotate folder/item.
- `<item_name>` is resolved from SuperAnnotate; the file name is always
  `<item_name>_annotation.json`.
- `POST /annotation/` writes this file (creating parent folders as needed);
  `GET /annotation/` reads it.

### Example: 3 image items

A minimal setup for team `1`, project `2`, with three items
(`test_00001`–`test_00003`), each exposing one image:

```text
local_storage/
  files/
    images/
      image_1.jpg
      image_2.jpg
      image_3.jpg
  access_maps/
    1/
      2/
        test_00001.json
        test_00002.json
        test_00003.json
  items/                         # created automatically after annotations are saved
    1/2/<folder_id>/
      test_00001_annotation.json
```

Each access map points one item at one image — e.g. `access_maps/1/2/test_00001.json`:

```json
{
  "label": "test_00001",
  "files": ["images/image_1.jpg"],
  "metadata": {}
}
```

`test_00002.json` → `images/image_2.jpg`, `test_00003.json` → `images/image_3.jpg`.

Calling `GET /storage/` for item `test_00001` then returns:

```json
{
  "label": "test_00001",
  "files": {
    "images/image_1.jpg": "https://<host>/storage/fileSigned?path=images%2Fimage_1.jpg&expires=...&signature=..."
  },
  "metadata": {}
}
```

#### Upload manifest (JSONL)

To create the matching items in SuperAnnotate, use a JSONL upload manifest — one
JSON object per line. The `metadata.name` of each line must match the access-map
file name (the item name). This file is consumed by SuperAnnotate's import, not by
this service.

`upload_1.jsonl`:

```jsonl
{"metadata":{"name":"test_00001","folder_name":"batch_1"},"data":{"image_annotation":{"value":{"name":"test_00001"}}}}
{"metadata":{"name":"test_00002","folder_name":"batch_1"},"data":{"image_annotation":{"value":{"name":"test_00002"}}}}
{"metadata":{"name":"test_00003","folder_name":"batch_1"},"data":{"image_annotation":{"value":{"name":"test_00003"}}}}
```

- `metadata.name` — item name; must match the access-map file name (`<item_name>.json`).
- `metadata.folder_name` — target SuperAnnotate folder (e.g. `batch_1`).
- `data.<component_id>.value` — initial component value (here component `image_annotation`).

## Testing

```bash
npm test            # run unit tests
npm run test:coverage
```

## License

ISC
