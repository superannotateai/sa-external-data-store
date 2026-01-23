# SuperAnnotate External Data Store

A Node.js/Express API service for managing data streams with AWS S3 storage backend. This service provides secure, authenticated endpoints for storing and retrieving data streams associated with SuperAnnotate items.

## Features

- **Stream-based data storage**: Efficient handling of large data streams using multipart uploads
- **S3 integration**: AWS S3 backend for scalable data storage
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
cd deepgram
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
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

### Health Check

**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "message": "OK"
}
```

### Get Data Stream

**GET** `/dataStream`

Retrieves a data stream for a specific item.

**Headers:**
- `Authorization`: SuperAnnotate access token (required)
- `sa-team-id`: Team ID (required)
- `sa-project-id`: Project ID (required)
- `sa-folder-id`: Folder ID (required)
- `sa-item-id`: Item ID (required)

**Response:**
- `200 OK`: Stream of data (Content-Type: text/plain)
- `404 Not Found`: Data stream not found
- `401 Unauthorized`: Invalid or missing authorization token
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X GET "http://localhost:3005/dataStream" \
  -H "Authorization: Bearer your-token" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4"
```

### Save Data Stream

**POST** `/dataStream`

Uploads a data stream for a specific item.

**Headers:**
- `Authorization`: SuperAnnotate access token (required)
- `sa-team-id`: Team ID (required)
- `sa-project-id`: Project ID (required)
- `sa-folder-id`: Folder ID (required)
- `sa-item-id`: Item ID (required)
- `Content-Length`: Size of the stream in bytes (optional)

**Body:**
- Raw stream data (text/plain)

**Response:**
```json
{
  "message": "Data stream saved successfully",
  "timestamp": "2024-01-23T12:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3005/dataStream" \
  -H "Authorization: Bearer your-token" \
  -H "sa-team-id: 1" \
  -H "sa-project-id: 2" \
  -H "sa-folder-id: 3" \
  -H "sa-item-id: 4" \
  -H "Content-Type: text/plain" \
  --data-binary "@data.txt"
```

## Project Structure

```
deepgram/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── middleware/
│   │   └── auth.ts              # Authentication middleware
│   ├── repository/
│   │   ├── index.ts             # Repository singleton
│   │   ├── s3Repository.ts      # S3 repository implementation
│   │   └── __tests__/           # Repository unit tests
│   ├── routes/
│   │   └── dataStream.ts        # Data stream routes
│   └── utils/
│       ├── config.ts             # Configuration management
│       ├── s3Sdk.ts              # AWS S3 SDK wrapper
│       └── saApi.ts              # SuperAnnotate API client
├── dist/                         # Compiled JavaScript output
├── jest.config.js                # Jest configuration
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript configuration
```

## Architecture

### Repository Pattern

The application uses a repository pattern to abstract data storage:

- **Repository**: Main repository interface (singleton)
- **S3Repository**: S3-specific implementation
- **S3Sdk**: Low-level AWS S3 operations

### Authentication Flow

1. Client sends request with `Authorization` header and SuperAnnotate IDs
2. Middleware validates token and item access via SuperAnnotate API
3. If authorized, request proceeds to route handler
4. Route handler uses repository to interact with S3

### Data Storage

Data is stored in S3 with the following path structure:
```
items/{teamId}/{projectId}/{folderId}/{itemId}.txt
```

Metadata is stored as:
```
items/{teamId}/{projectId}/{folderId}/{itemId}.json
```

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

- All endpoints require valid SuperAnnotate authentication tokens
- Item access is validated against SuperAnnotate API before processing
- AWS credentials should be stored securely (use environment variables)
- Never commit `.env` files to version control

## License

ISC

## Author

SuperAnnotate

