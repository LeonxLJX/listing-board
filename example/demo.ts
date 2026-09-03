
/**
 * Demo: seed a board, query it, then serve it on :8787.
 */
import { ListingStore, JsonFilePersistence } from "../src/store.ts";
import { createHandler } from "../src/http.ts";
import * as http from "node:http";

const store = new ListingStore(new JsonFilePersistence("demo-board.json"));

const seeded = await store.list();
if (seeded.total === 0) {
  await store.create({ title: "Beachfront villa", description: "4BR villa with pool", category: "stay", priceCents: 45000, tags: ["beach", "family"] });
  await store.create({ title: "City loft", description: "Studio in downtown", category: "stay", priceCents: 12000, tags: ["city"] });
  await store.create({ title: "Surf lesson", description: "2h beginner lesson", category: "activity", priceCents: 8000, tags: ["beach", "sport"] });
  console.log("seeded 3 listings");
}

const page = await store.list({ category: "stay", sort: "price_asc" });
console.log("stays by price:", page.items.map((l) => `${l.title} @ $${(l.priceCents / 100).toFixed(0)}`));

const server = http.createServer(createHandler(store));
server.listen(8787, () => console.log("listing-board on http://localhost:8787/api/listings"));
