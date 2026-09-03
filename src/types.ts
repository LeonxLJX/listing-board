
/**
 * Listing board types.
 */

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ListingInput = Partial<Omit<Listing, "id" | "createdAt" | "updatedAt">>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface QueryOptions {
  /** Case-insensitive substring match on title + description. */
  q?: string;
  category?: string;
  tag?: string;
  priceMinCents?: number;
  priceMaxCents?: number;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "title";
  page?: number;
  pageSize?: number;
}
