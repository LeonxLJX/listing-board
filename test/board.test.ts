
/**
 * Run: node --experimental-strip-types test/board.test.ts
 */
import { ListingStore, MemoryPersistence, ValidationError } from "../src/store.ts";
import { queryFromUrl } from "../src/http.ts";

let failures = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); console.log("PASS", name); }
  catch (e) { failures++; console.log("FAIL", name, e); }
}
function assert(cond: boolean, m = "assert"): void { if (!cond) throw new Error(m); }

function fresh(): ListingStore {
  return new ListingStore(new MemoryPersistence());
}

await test("create requires title, rejects negative price", async () => {
  const s = fresh();
  let threw = false;
  try { await s.create({ title: "  " }); } catch (e) { threw = e instanceof ValidationError; }
  assert(threw);
  threw = false;
  try { await s.create({ title: "x", priceCents: -1 }); } catch (e) { threw = e instanceof ValidationError; }
  assert(threw);
});

await test("update strips reserved fields and bumps updatedAt", async () => {
  const s = fresh();
  const a = await s.create({ title: "A" });
  await new Promise((r) => setTimeout(r, 5));
  const u = await s.update(a.id, { title: "A2", id: "hack", createdAt: 1, updatedAt: 1 } as any);
  assert(u && u.title === "A2" && u.id === a.id && u.createdAt === a.createdAt);
  assert(u.updatedAt > a.createdAt);
});

await test("query: category + price filters + sort", async () => {
  const s = fresh();
  await s.create({ title: "cheap stay", category: "stay", priceCents: 1000 });
  await s.create({ title: " pricey stay ", category: "stay", priceCents: 9000 });
  await s.create({ title: "tour", category: "activity", priceCents: 5000 });
  const page = await s.list({ category: "stay", priceMaxCents: 5000 });
  assert(page.total === 1 && page.items[0]!.title === "cheap stay");
  const sorted = await s.list({ sort: "price_desc" });
  assert(sorted.items[0]!.priceCents === 9000);
});

await test("q searches title AND description case-insensitively", async () => {
  const s = fresh();
  await s.create({ title: "Villa", description: "near the OCEAN" });
  await s.create({ title: "Cabin", description: "in the woods" });
  assert((await s.list({ q: "ocean" })).total === 1);
  assert((await s.list({ q: "VILLA" })).total === 1);
});

await test("pagination metadata is correct", async () => {
  const s = fresh();
  for (let i = 0; i < 25; i++) await s.create({ title: `item-${String(i).padStart(2, "0")}` });
  const p2 = await s.list({ page: 2, pageSize: 10, sort: "title" });
  assert(p2.total === 25 && p2.pageCount === 3 && p2.items.length === 10);
  assert(p2.items[0]!.title === "item-10", `page2 first should be item-10, got ${p2.items[0]?.title}`);
});

await test("tag filter matches any listed tag", async () => {
  const s = fresh();
  await s.create({ title: "a", tags: ["beach", "family"] });
  await s.create({ title: "b", tags: ["city"] });
  assert((await s.list({ tag: "beach" })).total === 1);
});

await test("remove returns false for unknown id", async () => {
  const s = fresh();
  const a = await s.create({ title: "a" });
  assert(await s.remove(a.id) === true);
  assert(await s.remove(a.id) === false);
});

await test("queryFromUrl parses and ignores garbage", async () => {
  const sp = new URLSearchParams("q=villa&page=2&pageSize=abc&sort=price_asc&priceMinCents=100");
  const q = queryFromUrl(sp);
  assert(q.q === "villa" && q.page === 2 && q.pageSize === undefined && q.sort === "price_asc" && q.priceMinCents === 100);
});

if (failures) process.exit(1);
console.log("\nall tests passed");
