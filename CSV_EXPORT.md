# CSV Export Endpoint Documentation

## Overview
The CSV export endpoint allows you to export seller registration data for a specific event in CSV format. This is useful for importing seller data into other systems or for reporting purposes.

## ⚠️ Security & Authentication
**This endpoint requires admin authentication.** It contains sensitive personal data (names, phone numbers, emails) and will return `401 Unauthorized` if accessed without proper admin credentials.

## Endpoint
```
GET /api/seller-number/export-csv
```

**Authentication**: Admin only (Bearer token required)

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `eventId` | string | Yes | - | The ID of the event to export data for |
| `mode` | string | No | `"kkm"` | Export mode: either `"kkm"` or `"azb"` |

## Export Modes

### KKM Mode (`mode=kkm`)
Exports with the following CSV columns:

| Column | Description | Current Status |
|--------|-------------|----------------|
| `nr` | Seller number | ✅ Available |
| `dnr` | Dauernummer (permanent number flag) | ⚠️ Empty (not in DB) |
| `babynr` | Babynummer (baby number flag) | ⚠️ Empty (not in DB) |
| `name` | Last name (Nachname) | ✅ Available |
| `vorname` | First name (Vorname) | ✅ Available |
| `Strasse` | Street address | ⚠️ Empty (not in DB) |
| `plz` | Postal code | ⚠️ Empty (not in DB) |
| `ort` | City | ⚠️ Empty (not in DB) |
| `tel` | Phone number | ✅ Available |
| `email` | Email address | ✅ Available |
| `interesse_dnr` | Interest in permanent number | ⚠️ Empty (not in DB) |
| `neu` | New seller flag | ⚠️ Empty (not in DB) |
| `ma` | Employee flag (Mitarbeiter) | ⚠️ Empty (not in DB) |

### AZB Mode (`mode=azb`)
Exports with the following CSV columns:

| Column | Description | Current Status |
|--------|-------------|----------------|
| `nr` | Seller number | ✅ Available |
| `name` | Last name | ✅ Available |
| `vorname` | First name | ✅ Available |
| `ab-status` | AB-Status | ⚠️ Empty (not in DB) |
| `tel` | Phone number | ✅ Available |
| `ma` | Employee flag | ⚠️ Empty (not in DB) |

## Authentication

Before using this endpoint, you must authenticate as an admin and obtain an authentication token.

### Step 1: Authenticate as Admin/Superuser
```bash
# Authenticate and get the token
curl -X POST https://reg.anziehbar-gummersbach.de/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "admin@example.com",
    "password": "your_admin_password"
  }'
```

This will return a response like:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "record": { ... }
}
```

### Step 2: Use the Token to Access the Endpoint
Include the token in the `Authorization` header with the `Bearer` prefix.

## Usage Examples

### Basic Export (KKM mode)
```bash
curl "https://reg.anziehbar-gummersbach.de/api/seller-number/export-csv?eventId=abc123xyz" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -o seller-numbers.csv
```

### Export in AZB mode
```bash
curl "https://reg.anziehbar-gummersbach.de/api/seller-number/export-csv?eventId=abc123xyz&mode=azb" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -o seller-numbers-azb.csv
```

### One-liner: Authenticate and Export
```bash
# Extract token and use it in one command (PocketBase 0.30.0+)
TOKEN=$(curl -X POST https://reg.anziehbar-gummersbach.de/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin@example.com","password":"your_password"}' \
  | jq -r '.token')

curl "https://reg.anziehbar-gummersbach.de/api/seller-number/export-csv?eventId=abc123xyz&mode=kkm" \
  -H "Authorization: Bearer $TOKEN" \
  -o seller-numbers.csv
```

## Response Format

### Success (200 OK)
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="seller-numbers-{eventName}-{mode}.csv"`
- **Body**: CSV formatted data with appropriate headers

Example CSV output (KKM mode):
```csv
nr,dnr,babynr,name,vorname,Strasse,plz,ort,tel,email,interesse_dnr,neu,ma
123,,,"Müller","Hans",,,,"0123456789","hans.mueller@example.com",,,
124,,,"Schmidt","Anna",,,,"0987654321","anna.schmidt@example.com",,,
```

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized: Admin access required"
}
```
**Cause**: Request is missing authentication or authenticated user is not an admin.

#### 400 Bad Request
```json
{
  "error": "eventId is required"
}
```
or
```json
{
  "error": "mode must be either \"kkm\" or \"azb\""
}
```

#### 404 Not Found
```json
{
  "error": "Event not found"
}
```
or
```json
{
  "error": "No seller number pools found for this event"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Data Source
The endpoint:
1. Finds all seller number pools associated with the specified event
2. Retrieves all seller numbers from those pools
3. Filters to only include seller numbers with completed registrations (i.e., those with associated seller details)
4. Sorts by seller number in ascending order
5. Formats the data according to the selected mode

## CSV Formatting
- Values containing commas, quotes, or newlines are automatically escaped with quotes
- Internal quotes are doubled (`"` becomes `""`)
- UTF-8 encoding is used
- Empty fields are represented as empty strings

## Security Notes
- **Admin/Superuser authentication is enforced** - only authenticated superuser accounts can access this endpoint
- The endpoint contains sensitive personal data and should only be accessed by authorized personnel
- Tokens expire based on PocketBase configuration (default: 7 days)
- For production use, ensure HTTPS is enabled to protect tokens in transit
- Consider implementing additional logging/auditing for CSV exports in production
- **PocketBase Version**: This documentation assumes PocketBase 0.30.0+ which uses `_superusers` collection for admins
