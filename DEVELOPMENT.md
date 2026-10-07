# Development

Notes for maintainers of the Tomba Clearbit Person Actor. The README is the end-user page shown on Apify Store.

## Requirements

- Node.js 20+
- [Apify CLI](https://docs.apify.com/cli) for deployment

## Scripts

```bash
npm install
npm run build     # compile TypeScript to dist/
npm run lint      # ESLint (src and test)
npm run format    # Prettier
npm test          # unit + end-to-end tests (node:test)
npm start         # run locally with tsx
```

## Credentials

The Actor uses our Tomba account. Credentials come from environment variables, never from the input:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `TOMBA_API_KEY`      | Tomba API key (`ta_…`)                             |
| `TOMBA_API_SECRET`   | Tomba secret (`ts_…`)                              |
| `TOMBA_API_ENDPOINT` | Optional API base URL; only used by the test suite |

`.actor/actor.json` maps the variables to Apify secrets:

```bash
apify secrets add tombaApiKey ta_xxxxxxxxxxxxxxxxxxxx
apify secrets add tombaApiSecret ts_xxxxxxxxxxxxxxxxxxxx
apify push
```

Run locally (input goes in `storage/key_value_stores/default/INPUT.json`, e.g. `{"emails": ["john@stripe.com"]}`):

```bash
TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
```

Deploy from Git instead: in Apify Console go to **Actors → Create new → Link Git Repository**, then add the two secrets as environment variables of the Actor.

## Pricing (pay per event)

In **Apify Console → Publication → Monetization**, choose **Pay per event** and add:

| Event           | Price    | Charged when                                  |
| --------------- | -------- | --------------------------------------------- |
| `tomba-request` | $0.00312 | Tomba returns a billable response (see below) |

`isBillable()` in `src/tomba.ts` mirrors Tomba's billing:

| Tomba outcome                                          | Charged |
| ------------------------------------------------------ | ------- |
| JSON with non-empty `data`, including negative answers | Yes     |
| Error status (4xx, 5xx, including 422 and 429)         | No      |
| Success with empty or null `data`                      | No      |
| Success with an `errors` object                        | No      |
| Non-JSON body (reported as 502)                        | No      |
| Cache hit                                              | No      |

## Architecture

- `src/tomba.ts`: shared helper, identical in every Tomba Actor. It handles credentials, caching (per-Actor `tomba-cache-<actorId>` key-value store; falls back to an in-run cache if it can't be opened), retries with exponential backoff, pay-per-event charging, budget reservation, the concurrency pool and resume state.
- `src/main.ts`: reads `emails`, normalizes and deduplicates them, applies `maxResults` (one dataset item per email), skips emails already in the resume state, then calls `Enrichment.person(email)` → `GET /people/find?email=…` through `callTomba('person', …)`.
- Output: billable responses are pushed as `{ ...data, email, source, charged, cached }` with `source: 'tomba_person_enrichment'`; empty or failed lookups are pushed as `{ email, source, charged: false, cached, error }` (`error` defaults to `No data found`).
- The `tomba` SDK v1.1.1 resolves every call to `{ data, rateLimit }`, where `data` is the response body. Its `.d.ts` types still declare the old return type, so always go through `callTomba()`.

## Tests

- `test/tomba.test.ts`: unit tests for the shared helper (identical in every Actor)
- `test/main.test.ts`: end-to-end tests that run `src/main.ts` against a local mock Tomba API
- `test/helpers.ts`: mock server and Actor runner (identical in every Actor)

Locally, the Apify SDK prices every event at $1 when `ACTOR_TEST_PAY_PER_EVENT=true`, so the tests use `maxTotalChargeUsd` as an event count.

## Standby mode (real-time API)

`.actor/actor.json` sets `usesStandbyMode: true` and `webServerSchema: ./web_server_schema.json` (OpenAPI 3).

- `src/standby.ts` (shared, identical in every Actor): `runActor()` runs a batch job, or, when `APIFY_META_ORIGIN=STANDBY`, starts an HTTP server on `Actor.config.get('containerPort')`.
    - `GET /` with the `x-apify-container-server-readiness-probe` header, or with no query: readiness / usage.
    - `GET /?…`: input built by `fromQuery()` in `src/main.ts` (`email` / `emails`, repeated or comma-separated, and `maxResults`).
    - `POST /`: the same JSON input as a batch run.
    - Responses: `200 { items }`, `400` invalid input, `402` max charge limit reached, `404`, `405`.
- `run(input, ctx)` in `src/main.ts` is shared by both modes: `ctx.push()` writes to the dataset in batch runs and to the HTTP response in Standby; `ctx.isDone()`/`ctx.markDone()` persist resume state only in batch runs. Input errors throw `InputError` (failed run in batch, `400` in Standby).
- `maxResults` only slices the input of the current request; it never stops the Actor, so a Standby server keeps serving. Only the max charge limit stops it.
- Caching and pay-per-event charging work the same in both modes.

Try it locally:

```bash
APIFY_META_ORIGIN=STANDBY ACTOR_WEB_SERVER_PORT=8080 TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
curl "localhost:8080/?email=john@stripe.com"
```

## Key-value store schema

`.actor/key_value_store_schema.json` documents the default key-value store records (`INPUT`, `TOMBA_STATE`). The cross-run cache lives in the separate named store `tomba-cache-<actorId>`, one per Actor: under limited permissions an Actor can only open named storages it created itself, so the Tomba Actors must not share one store. If the store can't be opened, the run logs a warning and caches for this run only.

## Memory

`defaultMemoryMbytes` is 256: the Actor only makes HTTP calls, so more memory just costs more.
