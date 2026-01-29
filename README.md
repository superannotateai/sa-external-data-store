# SuperAnnotate External Data Store

A Node.js/Express API service for managing data streams with AWS S3 storage backend. This service provides secure, authenticated endpoints for storing and retrieving data streams associated with SuperAnnotate items.

## Features

- **Stream-based data storage**: Efficient handling of large data streams using multipart uploads
- **Multiple storage backends**: Support for both AWS S3 and local filesystem storage
- **S3 integration**: AWS S3 backend for scalable cloud data storage
- **Local filesystem storage**: Local filesystem backend for development and on-premise deployments
- **Authentication**: Integration with SuperAnnotate API for secure access control
- **TypeScript**: Full TypeScript support with type safety
- **Unit tests**: Comprehensive test coverage for repository layer

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- AWS S3 bucket with appropriate credentials
- SuperAnnotate API access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sa-external-data-store
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

**For S3 Storage:**
```env
# Server Configuration
PORT=3005

# Data Store Configuration
DATA_STORE=S3

# AWS S3 Configuration
S3_BUCKET_NAME=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_REGION=us-east-1

# SuperAnnotate API Configuration
SA_AUTH_HOST=https://api.superannotate.com
```

**For Local Filesystem Storage:**
```env
# Server Configuration
PORT=3005

# Data Store Configuration
DATA_STORE=LOCAL

# Local Storage Configuration
LOCAL_STORAGE_PATH=/path/to/storage/directory

# Signed URL Configuration (for /file and /dataUrl)
LOCAL_SIGN_SECRET_KEY=your-secret-key-for-signing-urls
SIGN_URL_EXPIRATION_TIME_HR=24

# SuperAnnotate API Configuration
SA_AUTH_HOST=https://api.superannotate.com
```

## Usage

### Development

Run the development server with hot-reload:
```bash
npm run dev
```

### Production

1. Build the TypeScript code:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

### Testing

Run unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate test coverage report:
```bash
npm run test:coverage
```

## API Endpoints

The API exposes file storage and retrieval for SuperAnnotate items. The resource model is **Team → Project → Folder → Item → File(s)**. A file is identified by `teamId`, `projectId`, `folderId`, `itemId`, and `fileName`.

### Health Check

**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "message": "OK"
}
```

---

### Data Stream (SuperAnnotate-authenticated)

These endpoints require a valid SuperAnnotate access token and item-scoping headers. The middleware validates the token and item access via the SuperAnnotate API before handling the request.

#### Get Data Stream

**GET** `/dataStream`

Streams file content for a specific item and file name.

**Headers:**
- `Authorization`: SuperAnnotate access token (required)
- `sa-team-id`: Team ID (required)
- `sa-project-id`: Project ID (required)
- `sa-folder-id`: Folder ID (required)
- `sa-item-id`: Item ID (required)
- `sa-file-name`: File name (required)

**Response:**
- `200 OK`: Stream of data (`Content-Type: text/plain`, `Transfer-Encoding: chunked`)
- `400 Bad Request`: Invalid or missing required headers
- `401 Unauthorized`: Invalid or missing authorization token
- `404 Not Found`: Item or data stream not found
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X GET "http://localhost:3005/dataStream" \
  -H "Authorization: Bearer your-token" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4" \
  -H "sa-file-name: document.pdf"
```

#### Save Data Stream

**POST** `/dataStream`

Uploads (or replaces) file content for a specific item and file name.

**Headers:**
- `Authorization`: SuperAnnotate access token (required)
- `sa-team-id`: Team ID (required)
- `sa-project-id`: Project ID (required)
- `sa-folder-id`: Folder ID (required)
- `sa-item-id`: Item ID (required)
- `sa-file-name`: File name (required)
- `Content-Length`: Size of the stream in bytes (optional but recommended)
- `Content-Type`: e.g. `text/plain` or `application/octet-stream` (optional)

**Body:** Raw binary or text stream.

**Response:**
- `200 OK`: Success
```json
{
  "message": "Data stream saved successfully",
  "timestamp": "2024-01-23T12:00:00.000Z"
}
```
- `400 Bad Request`: Invalid or missing required headers
- `401 Unauthorized`: Invalid or missing authorization token
- `404 Not Found`: Item not found
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X POST "http://localhost:3005/dataStream" \
  -H "Authorization: Bearer your-token" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4" \
  -H "sa-file-name: document.pdf" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@document.pdf"
```

#### Get Signed URL

**GET** `/dataUrl`

Returns a pre-signed URL for a file (S3) or a signed download URL (local storage). The client can use this URL to download the file without sending the SuperAnnotate token again.

**Headers:**
- `Authorization`: SuperAnnotate access token (required)
- `sa-team-id`: Team ID (required)
- `sa-project-id`: Project ID (required)
- `sa-folder-id`: Folder ID (required)
- `sa-item-id`: Item ID (required)
- `sa-file-name`: File name (required)

**Response:**
- `200 OK`: Signed URL
```json
{
  "signedUrl": "https://...",
  "timestamp": "2024-01-23T12:00:00.000Z"
}
```
- `400 Bad Request`: Invalid or missing required headers
- `401 Unauthorized`: Invalid or missing authorization token
- `404 Not Found`: Item or file not found
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X GET "http://localhost:3005/dataUrl" \
  -H "Authorization: Bearer your-token" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4" \
  -H "sa-file-name: document.pdf"
```

---

### File Download (Signed URL)

**GET** `/file/:fileName`

Serves a file using a signed URL. No SuperAnnotate token is required; authentication is done via query parameters signed with `LOCAL_SIGN_SECRET_KEY`. Typically used with URLs returned from the `/dataUrl` endpoint when using local storage.

**Query parameters:**
- `path`: Relative file path (e.g. `items/1/2/3/4/document.pdf`) — required
- `expires`: Expiration timestamp (Unix ms) — required
- `signature`: HMAC-SHA256 signature of `{path}-{expires}` — required

**Response:**
- `200 OK`: File content (appropriate `Content-Type` for the file)
- `400 Bad Request`: Missing required parameters
- `403 Forbidden`: URL expired or invalid signature
- `404 Not Found`: File does not exist
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X GET "http://localhost:3005/file/document.pdf?path=items%2F1%2F2%2F3%2F4%2Fdocument.pdf&expires=1706025600000&signature=<signature>"
```

---

### REST API Design (Reference)

For future versions, a resource-oriented REST API could use path parameters instead of headers:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/teams/:teamId/projects/:projectId/folders/:folderId/items/:itemId/files/:fileName/content` | Stream file content |
| `PUT` | `/api/v1/teams/:teamId/projects/:projectId/folders/:folderId/items/:itemId/files/:fileName/content` | Upload/replace file content |
| `GET` | `/api/v1/teams/:teamId/projects/:projectId/folders/:folderId/items/:itemId/files/:fileName/signed-url` | Get signed URL |
| `GET` | `/api/v1/download?path=&expires=&signature=` | Download via signed query (no SA token) |

Authentication for the first three would remain the `Authorization` header; the download endpoint would continue to use the signed query parameters.

## Project Structure

```
sa-external-data-store/
├── src/
│   ├── index.ts                  # Application entry point
│   ├── middleware/
│   │   ├── auth.ts               # SuperAnnotate authentication middleware
│   │   └── localSignValidator.ts # Signed URL validation for /file
│   ├── repository/
│   │   ├── index.ts              # Repository singleton and factory
│   │   ├── s3Repository.ts        # S3 repository implementation
│   │   ├── localRepository.ts    # Local filesystem repository implementation
│   │   └── __tests__/            # Repository unit tests
│   ├── routes/
│   │   ├── dataStream.ts         # Data stream (GET/POST) routes
│   │   ├── signedDownload.ts     # Signed URL (GET /dataUrl) route
│   │   └── fileDownload.ts       # File download (GET /file/:fileName) route
│   └── utils/
│       ├── config.ts             # Configuration management
│       ├── functions.ts          # Shared helpers (e.g. parse headers)
│       ├── s3Sdk.ts              # AWS S3 SDK wrapper
│       ├── saApi.ts              # SuperAnnotate API client
│       └── __tests__/            # Utils unit tests
├── dist/                         # Compiled JavaScript output
├── jest.config.js                # Jest configuration
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript configuration
```

## Architecture

### Storage Backend Selection

The service supports multiple storage backends that can be switched via the `DATA_STORE` environment variable:

- **S3**: AWS S3 cloud storage (set `DATA_STORE=S3`)
- **LOCAL**: Local filesystem storage (set `DATA_STORE=LOCAL`)

### Repository Pattern

The application uses a repository pattern to abstract data storage:

- **Repository**: Main repository interface (singleton) that delegates to the configured backend
- **S3Repository**: S3-specific implementation using AWS SDK
- **LocalRepository**: Local filesystem implementation using Node.js fs module
- **S3Sdk**: Low-level AWS S3 operations

### Authentication Flow

1. Client sends request with `Authorization` header and SuperAnnotate IDs
2. Middleware validates token and item access via SuperAnnotate API
3. If authorized, request proceeds to route handler
4. Route handler uses repository to interact with S3

### Data Storage

Data is stored with the following path structure (consistent across both storage backends):

**File storage:**
```
items/{teamId}/{projectId}/{folderId}/{itemId}/{fileName}
```

Each item can have multiple files; each file is identified by `fileName` within the item path.

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Run development server with nodemon
- `npm run watch`: Watch TypeScript files and compile on changes
- `npm test`: Run unit tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Generate test coverage report
- `npm run clean`: Remove compiled output directory

### Code Style

- Use 4 spaces for indentation
- Use double quotes for strings
- Follow TypeScript strict mode guidelines

## Error Handling

The API returns standardized error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "timestamp": "ISO 8601 timestamp"
}
```

Common error codes:
- `400 Bad Request`: Missing or invalid required headers
- `401 Unauthorized`: Invalid or missing authorization token
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

## Security

- **SuperAnnotate-authenticated endpoints** (`/dataStream`, `/dataUrl`): Require a valid SuperAnnotate access token in the `Authorization` header. Item access is validated against the SuperAnnotate API before processing.
- **Signed download** (`/file/:fileName`): Does not use SuperAnnotate tokens. Access is granted via HMAC-signed query parameters (`path`, `expires`, `signature`) using `LOCAL_SIGN_SECRET_KEY`. URLs expire after the configured `SIGN_URL_EXPIRATION_TIME_HR`.
- AWS credentials and `LOCAL_SIGN_SECRET_KEY` should be stored securely (use environment variables).
- Never commit `.env` files to version control.

## License

ISC

## Author

SuperAnnotate

