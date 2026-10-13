/**
 * Part-name convention for CAD/GLB files (docs/CAD-BRIEF.md). A mesh whose name, or whose parent's name, starts with
 * one of these prefixes gets the matching library material, so a new piece needs no catalog `materialRules`.
 * Anything else keeps the material it came with.
 */
const PREFIX_TO_MATERIAL: [prefix: string, material: string][] = [
  ['ROSEGOLD_', 'rose-gold'],
  ['GOLD_', 'yellow-gold'],
  ['SILVER_', 'silver'],
  ['PLATINUM_', 'silver'],
  ['WHITEGOLD_', 'silver'],
  ['DIAMOND_', 'diamond'],
  ['POLKI_', 'diamond'],
  ['RUBY_', 'ruby'],
  ['EMERALD_', 'emerald'],
  ['PEARL_', 'pearl'],
];

/** Library material for a node name (case-insensitive), or undefined when the name carries no convention. */
export function materialForName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const n = name.toUpperCase();
  return PREFIX_TO_MATERIAL.find(([p]) => n.startsWith(p))?.[1];
}

/** Names that opt out of material replacement: the artist's own material (for example enamel) is kept. */
export const KEEP_PREFIX = 'KEEP_';
export const keepsOwnMaterial = (name: string | undefined) => !!name && name.toUpperCase().startsWith(KEEP_PREFIX);

export const KNOWN_PREFIXES = [...PREFIX_TO_MATERIAL.map(([p]) => p), KEEP_PREFIX];
