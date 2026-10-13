import type { CatalogItem } from '../types';

const COLOURS: Record<string, [string, string, string]> = {
  'yellow-gold': ['#fff1c5', '#d4af37', '#6b5413'],
  'rose-gold': ['#ffded4', '#c98a77', '#6e3c2e'],
  silver: ['#ffffff', '#dbe3ea', '#707c87'],
  diamond: ['#ffffff', '#d4e7ff', '#7ea1ce'],
  ruby: ['#ffa3b2', '#bd0f34', '#520311'],
  emerald: ['#92eec4', '#0c995e', '#034527'],
  pearl: ['#ffffff', '#fcf8f2', '#b8a994'],
};

/** Style for a thumbnail: real image when the catalog has one, else a glowing luxury material swatch. */
export function swatch(it: CatalogItem): Partial<CSSStyleDeclaration> {
  if (it.thumbnail) {
    return {
      backgroundImage: `url("${it.thumbnail}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  const [a, b, c] = COLOURS[it.material] ?? COLOURS['yellow-gold'];
  return {
    backgroundImage: `radial-gradient(circle at 40% 35%, ${a}, ${b} 55%, ${c})`,
    backgroundSize: 'cover',
  };
}
