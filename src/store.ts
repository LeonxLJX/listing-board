
/**
 * Typed CRUD store with atomic-ish JSON file persistence (tmp + rename).
 * Swap Persistence for Postgres/Redis by implementing the two methods.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { Listing, ListingInput, QueryOptions, Page } from "./types.ts";

export interface Persistence {
  read(): Promise<Listing[]>;
  write(listings: Listing[]): Promise<void>;
}

export class JsonFilePersistence implements Persistence {
  private file: string;
  constructor(file: string) {
    this.file = path.resolve(file);
  }
  async read(): Promise<Listing[]> {
    try {
      return JSON.parse(await fs.promises.readFile(this.file, "utf8")) as Listing[];
    } catch {
      return [];
    }
  }
  async write(listings: Listing[]): Promise<void> {
    const tmp = this.file + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(listings, null, 2), "utf8");
    await fs.promises.rename(tmp, this.file); // atomic on POSIX, near-atomic on NTFS
  }
}

export class MemoryPersistence implements Persistence {
  private items: Listing[] = [];
  async read(): Promise<Listing[]> {
    return this.items;
  }
  async write(listings: Listing[]): Promise<void> {
    this.items = listings;
  }
}

let seq = 0;
function newId(): string {
  return `lst_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export class ListingStore {
  private persistence: Persistence;

  constructor(persistence: Persistence = new MemoryPersistence()) {
    this.persistence = persistence;
  }

  async create(input: ListingInput): Promise<Listing> {
    if (!input.title?.trim()) throw new ValidationError("title is required");
    if (input.priceCents !== undefined && input.priceCents < 0) throw new ValidationError("priceCents must be >= 0");
    const now = Date.now();
    const listing: Listing = {
      id: newId(),
      title: input.title.trim(),
      description: input.description ?? "",
      category: input.category ?? "general",
      priceCents: input.priceCents ?? 0,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    const all = await this.persistence.read();
    all.push(listing);
    await this.persistence.write(all);
    return listing;
  }

  async get(id: string): Promise<Listing | undefined> {
    return (await this.persistence.read()).find((l) => l.id === id);
  }

  async update(id: string, patch: ListingInput): Promise<Listing | undefined> {
    const all = await this.persistence.read();
    const idx = all.findIndex((l) => l.id === id);
    if (idx < 0) return undefined;
    const next: Listing = { ...all[idx], ...stripReserved(patch), updatedAt: Date.now() };
    if (!next.title.trim()) throw new ValidationError("title is required");
    all[idx] = next;
    await this.persistence.write(all);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const all = await this.persistence.read();
    const next = all.filter((l) => l.id !== id);
    if (next.length === all.length) return false;
    await this.persistence.write(next);
    return true;
  }

  async list(opts: QueryOptions = {}): Promise<Page<Listing>> {
    let items = await this.persistence.read();
    const total = countMatching(items, opts);

    if (opts.q) {
      const needle = opts.q.toLowerCase();
      items = items.filter((l) =>
        l.title.toLowerCase().includes(needle) || l.description.toLowerCase().includes(needle));
    }
    if (opts.category) items = items.filter((l) => l.category === opts.category);
    if (opts.tag) items = items.filter((l) => l.tags.includes(opts.tag!));
    if (opts.priceMinCents !== undefined) items = items.filter((l) => l.priceCents >= opts.priceMinCents!);
    if (opts.priceMaxCents !== undefined) items = items.filter((l) => l.priceCents <= opts.priceMaxCents!);

    items = sortItems(items, opts.sort ?? "newest");

    const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 20));
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.max(1, Math.min(pageCount, opts.page ?? 1));
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total, page, pageSize, pageCount,
    };
  }
}

export class ValidationError extends Error {}

function countMatching(items: Listing[], opts: QueryOptions): number {
  // total = count AFTER filters but BEFORE pagination
  let n = 0;
  const needle = opts.q?.toLowerCase();
  for (const l of items) {
    if (needle && !(l.title.toLowerCase().includes(needle) || l.description.toLowerCase().includes(needle))) continue;
    if (opts.category && l.category !== opts.category) continue;
    if (opts.tag && !l.tags.includes(opts.tag)) continue;
    if (opts.priceMinCents !== undefined && l.priceCents < opts.priceMinCents) continue;
    if (opts.priceMaxCents !== undefined && l.priceCents > opts.priceMaxCents) continue;
    n++;
  }
  return n;
}

function sortItems(items: Listing[], sort: NonNullable<QueryOptions["sort"]>): Listing[] {
  const s = [...items];
  switch (sort) {
    case "newest": return s.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest": return s.sort((a, b) => a.createdAt - b.createdAt);
    case "price_asc": return s.sort((a, b) => a.priceCents - b.priceCents);
    case "price_desc": return s.sort((a, b) => b.priceCents - a.priceCents);
    case "title": return s.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function stripReserved(patch: ListingInput): ListingInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = patch as Partial<Listing>;
  return rest;
}
