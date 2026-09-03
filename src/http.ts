
/**
 * Zero-dependency REST router over node:http for the listing store.
 *
 *   GET    /api/listings?q=&category=&page=
 *   POST   /api/listings
 *   GET    /api/listings/:id
 *   PATCH  /api/listings/:id
 *   DELETE /api/listings/:id
 */
import * as http from "node:http";
import { ListingStore, ValidationError } from "./store.ts";
import type { ListingInput, QueryOptions } from "./types.ts";

export function createHandler(store: ListingStore): http.RequestListener {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // ["api","listings",":id"?]
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    try {
      if (parts[0] !== "api" || parts[1] !== "listings") return send(404, { error: "not found" });

      if (parts.length === 2) {
        if (req.method === "POST") {
          const body = await readJson(req) as ListingInput;
          const listing = await store.create(body);
          return send(201, listing);
        }
        if (req.method === "GET") {
          return send(200, await store.list(queryFromUrl(url.searchParams)));
        }
        return send(405, { error: "method not allowed" });
      }

      const id = parts[2]!;
      if (req.method === "GET") {
        const listing = await store.get(id);
        return listing ? send(200, listing) : send(404, { error: "not found" });
      }
      if (req.method === "PATCH") {
        const listing = await store.update(id, (await readJson(req)) as ListingInput);
        return listing ? send(200, listing) : send(404, { error: "not found" });
      }
      if (req.method === "DELETE") {
        return send(200, { deleted: await store.remove(id) });
      }
      return send(405, { error: "method not allowed" });
    } catch (err) {
      if (err instanceof ValidationError) return send(422, { error: err.message });
      return send(500, { error: err instanceof Error ? err.message : "internal error" });
    }
  };
}

export function queryFromUrl(sp: URLSearchParams): QueryOptions {
  const num = (k: string): number | undefined => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const sort = sp.get("sort");
  return {
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    priceMinCents: num("priceMinCents"),
    priceMaxCents: num("priceMaxCents"),
    sort: (sort === "newest" || sort === "oldest" || sort === "price_asc" || sort === "price_desc" || sort === "title")
      ? sort : undefined,
    page: num("page"),
    pageSize: num("pageSize"),
  };
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c: Buffer) => {
      data += c.toString();
      if (data.length > 1_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new ValidationError("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
