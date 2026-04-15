# Profile API

Serverless API that accepts a name, calls Genderize, Agify, and Nationalize in parallel, aggregates the response, and stores one canonical profile per name.

## Tech Stack

- Runtime: Node.js (package requires Node >= 18)
- API style: Vercel serverless functions under `api/`
- Database: MongoDB (`mongodb` driver)
- IDs: custom UUID v7 generator (`src/uuidv7.js`)

## Environment Variables

Create a `.env` file (or configure in Vercel):

```env
MONGODB_URI=<your-mongodb-connection-string>
MONGODB_DB=profileapi
```

`MONGODB_DB` is optional and defaults to `profileapi`.

## Run Locally

Install dependencies:

```bash
npm install
```

Start with Vercel dev server:

```bash
npx vercel dev
```

Default local URL is usually `http://localhost:3000`.

## API Endpoints

### `GET /api/health`

Health check.

Example response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-15T10:20:30Z"
}
```

### `POST /api/profiles`

Creates a profile if it does not exist, otherwise returns existing profile (idempotent by normalized name).

Request body:

```json
{
  "name": "Ella"
}
```

Notes:

- Input name is normalized to `trim().toLowerCase()` before lookup/storage.
- A unique index on `profiles.name` enforces idempotency at DB level.

Created response (`201`):

```json
{
  "status": "success",
  "data": {
    "id": "0195f2a3-8d27-7f12-8b5e-45d2f4e62f13",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.085,
    "created_at": "2026-04-15T10:20:30Z"
  }
}
```

Already exists (`200`):

```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": {
    "id": "0195f2a3-8d27-7f12-8b5e-45d2f4e62f13",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.085,
    "created_at": "2026-04-15T10:20:30Z"
  }
}
```

### `GET /api/profiles/:name`

Fetches a previously stored profile by name.

Success (`200`):

```json
{
  "status": "success",
  "data": {
    "id": "0195f2a3-8d27-7f12-8b5e-45d2f4e62f13",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DK",
    "country_probability": 0.085,
    "created_at": "2026-04-15T10:20:30Z"
  }
}
```

Not found (`404`):

```json
{
  "status": "error",
  "message": "Profile not found"
}
```

## Validation and Error Handling

POST `/api/profiles`:

- `400` `Name is required` when name is missing, null, or empty string.
- `422` `Name must be a string` when name is not a string.
- `422` when external data is incomplete:
  - `Genderize returned no gender data for this name`
  - `Genderize returned zero sample count for this name`
  - `Agify returned no age data for this name`
  - `Nationalize returned no country data for this name`
- `502` `Failed to reach external API` when external API request fails.
- `500` `Internal server error` for unhandled errors.

Method restrictions:

- `/api/profiles` supports `POST` and `OPTIONS`.
- `/api/profiles/:name` supports `GET` and `OPTIONS`.
- Unsupported methods return `405` with `Method not allowed`.

All non-health errors follow:

```json
{
  "status": "error",
  "message": "..."
}
```

## Aggregation Rules

The service combines external API results into one profile:

1. Genderize:
   - `gender`
   - `probability` -> `gender_probability`
   - `count` -> `sample_size`
2. Agify:
   - `age`
   - derived `age_group`:
     - `0-12` -> `child`
     - `13-19` -> `teenager`
     - `20-59` -> `adult`
     - `60+` -> `senior`
3. Nationalize:
   - selects highest probability country as `country_id`
   - stores that probability as `country_probability`

## CORS

All handlers set:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Project Structure

```text
api/
  health.js
  profiles/
    index.js      # POST /api/profiles
    [name].js     # GET /api/profiles/:name
src/
  db.js           # Mongo connection + unique index creation
  helpers.js      # CORS, UTC timestamp, response formatting
  profileService.js
  uuidv7.js
package.json
```
