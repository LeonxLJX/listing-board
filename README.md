# listing-board

An embeddable **listing / directory board** backend: typed CRUD, JSON-file persistence with atomic writes, a filter-sort-paginate query engine, and a zero-dependency REST router. ~500 strict-TypeScript lines, Node 18+.

A good fit for "we need a small directory / marketplace board" freelance builds: swap `JsonFilePersistence` for Postgres later without touching query or HTTP layers.

## API

```
GET    /api/listings?q=&category=&tag=&priceMinCents=&priceMaxCents=&sort=&page=&pageSize=
POST   /api/listings          {title, description?, category?, priceCents?, tags?}
GET    /api/listings/:id
PATCH  /api/listings/:id
DELETE /api/listings/:id
```

## Details that matter

- **Pagination contract** - `total` is the filtered count *before* pagination; `pageCount` derives from it. Clamped: page beyond the end returns the last page, pageSize capped at 100.
- **Reserved fields** (`id`, `createdAt`, `updatedAt`) are stripped from PATCH bodies - clients can't forge audit fields.
- **Atomic persistence** - write to `file.tmp`, then rename; a crash mid-write never corrupts the store.
- **Validation errors -> 422**, not found -> 404, bad JSON -> 422, everything else -> 500 with a message.

## Quick start

```bash
npm test
npm run demo   # seeds a board, prints a sorted query, serves on :8787
```

MIT License.
