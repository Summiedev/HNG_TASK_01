# Profile API

A REST API that accepts a name, calls Genderize, Agify, and Nationalize APIs in parallel, aggregates the results, and persists them with idempotency.

## Stack

- **Runtime**: Node.js 20
- **Framework**: Express
- **Database**: SQLite via `sql.js` (pure JS, no native bindings)
- **IDs**: UUID v7 (time-ordered)

## Quick Start

```bash
npm install
npm start
# Server runs on http://localhost:3000
```

Or with Docker:

```bash
docker build -t profile-api .
docker run -p 3000:3000 -v $(pwd)/data:/app/data profile-api
```

## Endpoints

### `POST /api/profiles`

Create or retrieve a profile for a given name.

**Request:**
```json
{ "name": "ella" }
```

**Success (201 Created):**
```json
{
  "status": "success",
  "data": {
    "id": "019d8ccd-bd70-7e82-a7d4-d1ad3b3b7b0d",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.085,
    "created_at": "2026-04-14T12:00:00Z"
  }
}
```

**Already exists (200 OK):**
```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": { ... }
}
```

### `GET /api/profiles/:name`

Look up a stored profile by name.

### `GET /health`

Health check endpoint.

## Validation & Error Handling

| Condition | Status | Message |
|-----------|--------|---------|
| Missing/empty `name` | 400 | Name is required |
| Non-string `name` | 422 | Name must be a string |
| Genderize returns null gender | 422 | Genderize returned no gender data |
| Genderize returns count=0 | 422 | Genderize returned zero sample count |
| Agify returns null age | 422 | Agify returned no age data |
| Nationalize returns no countries | 422 | Nationalize returned no country data |
| External API unreachable | 502 | Failed to connect to external API |
| Server error | 500 | Internal server error |

All error responses follow:
```json
{ "status": "error", "message": "..." }
```

## Processing Rules

1. **Genderize**: extracts `gender`, `probability` → `gender_probability`, `count` → `sample_size`
2. **Agify**: extracts `age`, classifies into `age_group`:
   - 0–12 → `child`
   - 13–19 → `teenager`
   - 20–59 → `adult`
   - 60+ → `senior`
3. **Nationalize**: picks the country with highest `probability` as `country_id`
4. **Idempotency**: same name returns existing record with `"message": "Profile already exists"`
5. **IDs**: UUID v7 (time-ordered, RFC 9562)
6. **Timestamps**: UTC ISO 8601



## Project Structure

```
├── index.js              # Entry point
├── src/
│   ├── app.js            # Express app & routes
│   ├── db.js             # SQLite database layer
│   ├── profileService.js # External API calls & aggregation
│   └── uuidv7.js         # UUID v7 generator
└── package.json
```
