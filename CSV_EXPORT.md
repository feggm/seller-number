# CSV Export Endpoint Documentation

## Overview
The CSV export endpoint allows you to export seller registration data for a specific event in CSV format. This is useful for importing seller data into other systems or for reporting purposes.

## ⚠️ Security & Authentication
**This endpoint requires authentication.** It contains sensitive personal data (names, phone numbers, emails) and will return `401 Unauthorized` if accessed without credentials. Accepted: a superuser, or a record of the `apiClients` auth collection — a machine account that can call the export endpoints and nothing else (see `docs/ARCHITECTURE.md`).

There is a second, machine-readable form of the same export: `GET /api/seller-number/export-assignment` returns a JSON envelope with the rows, the identical CSV embedded and a sha256 checksum over it. Both are rendered by `pb_hooks/export-core.js`, so the download here and the `csv` in the envelope are byte-identical.

## Endpoint
```
GET /api/seller-number/export-csv
```

**Authentication**: superuser or `apiClients` record (Bearer token required)

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
| `dnr` | Dauernummer (permanent number flag) | `D` when `sellerDetails.permanentNumberHolder` is set — rows the Dauernummer register materialised |
| `babynr` | Babynummer (baby number flag) | ✅ `B` when the number's variation is named like `/baby/i` |
| `name` | Last name (Nachname) | ✅ Available |
| `vorname` | First name (Vorname) | ✅ Available |
| `Strasse` | Street address | ⚠️ Empty (not in DB) |
| `plz` | Postal code | ⚠️ Empty (not in DB) |
| `ort` | City | ⚠️ Empty (not in DB) |
| `tel` | Phone number | ✅ Available |
| `email` | Email address | ✅ Available |
| `interesse_dnr` | Interest in permanent number | ⚠️ Always empty — the consumer never reads it |
| `neu` | New seller flag | `N` when the registered name (hash pair, exchange normalisation) appears in no earlier market of the category in `marketSellers` — the trail the cash desk pushes after each market, back to 2013 through the backfill. Empty for everyone, with a `neu_unknown` warning in the envelope, while the category has no trail yet |
| `ma` | Employee flag (Mitarbeiter) | ✅ `M` when `sellerDetails.isStaff` is set |

### AZB Mode (`mode=azb`)
Exports with the following CSV columns:

| Column | Description | Current Status |
|--------|-------------|----------------|
| `nr` | Seller number | ✅ Available |
| `name` | Last name | ✅ Available |
| `vorname` | First name | ✅ Available |
| `ab-status` | AB-Status | ⚠️ Empty (not in DB) |
| `tel` | Phone number | ✅ Available |
| `email` | Email address | ✅ Available |
| `ma` | Employee flag | ✅ `M` when `sellerDetails.isStaff` is set |

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
# Prompts for event ID, mode, admin e-mail and password (password is not echoed), then exports (PocketBase 0.30.0+)
printf 'Event-ID: ' && read -r EVENT_ID && \
printf 'Modus [kkm/azb] (Enter = kkm): ' && read -r MODE && MODE=${MODE:-kkm} && \
printf 'Admin-E-Mail: ' && read -r IDENTITY && printf 'Passwort: ' && read -rs PASSWORD && echo && \
TOKEN=$(curl -s -X POST https://reg.anziehbar-gummersbach.de/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg i "$IDENTITY" --arg p "$PASSWORD" '{identity: $i, password: $p}')" \
  | jq -r '.token') && unset PASSWORD && \
curl "https://reg.anziehbar-gummersbach.de/api/seller-number/export-csv?eventId=$EVENT_ID&mode=$MODE" \
  -H "Authorization: Bearer $TOKEN" \
  -o "seller-numbers-$MODE.csv"
```

Works in both zsh and bash. The JSON body is built with `jq -n --arg`, so passwords containing
quotes or backslashes are escaped correctly. The output file is named after the chosen mode
(`seller-numbers-kkm.csv` / `seller-numbers-azb.csv`).

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
- **Authentication is enforced** - superusers and `apiClients` records only; the latter cannot reach any other route or collection
- The endpoint contains sensitive personal data and should only be accessed by authorized personnel
- Tokens expire based on PocketBase configuration (superusers: default 7 days; `apiClients`: 1 hour)
- For production use, ensure HTTPS is enabled to protect tokens in transit
- Consider implementing additional logging/auditing for CSV exports in production
- **PocketBase Version**: This documentation assumes PocketBase 0.30.0+ which uses `_superusers` collection for admins
