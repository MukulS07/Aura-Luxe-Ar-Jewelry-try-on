import type { CatalogItem } from '../types';

/** Used when a catalog entry carries no `dimensions`. Average sizes, TODO(confirm) per piece with the business. */
export const DEFAULT_SIZE_MM = { earrings: 42, necklace: 124 } as const;

/** Real-world size of a piece, from the catalog entry (data, not code). `sizeMm` = drop height (earrings) or width (necklace). */
export function pieceSpec(item: CatalogItem): { sizeMm: number; yOffsetMm: number } {
  const d = item.dimensions;
  return {
    sizeMm: d && d.sizeMm > 0 ? d.sizeMm : DEFAULT_SIZE_MM[item.type],
    yOffsetMm: d?.yOffsetMm ?? 0,
  };
}
