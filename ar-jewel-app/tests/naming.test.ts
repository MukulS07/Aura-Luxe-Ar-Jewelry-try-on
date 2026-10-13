import { describe, expect, it } from 'vitest';
import { keepsOwnMaterial, materialForName } from '../src/render/naming';
import { MATERIAL_NAMES } from '../src/render/materials';

describe('CAD part naming', () => {
  it('maps prefixes to library materials, case-insensitive', () => {
    expect(materialForName('GOLD_frame')).toBe('yellow-gold');
    expect(materialForName('gold_frame')).toBe('yellow-gold');
    expect(materialForName('ROSEGOLD_bail')).toBe('rose-gold'); // not swallowed by GOLD_
    expect(materialForName('DIAMOND_center_01')).toBe('diamond');
    expect(materialForName('PEARL_drop_3')).toBe('pearl');
    expect(materialForName('PLATINUM_prong')).toBe('silver');
  });
  it('every mapped material exists in the library', () => {
    for (const n of ['GOLD_', 'ROSEGOLD_', 'SILVER_', 'DIAMOND_', 'RUBY_', 'EMERALD_', 'PEARL_', 'POLKI_', 'PLATINUM_', 'WHITEGOLD_'])
      expect(MATERIAL_NAMES).toContain(materialForName(n + 'x'));
  });
  it('names without the convention are left alone', () => {
    expect(materialForName('Part_4')).toBeUndefined();
    expect(materialForName(undefined)).toBeUndefined();
    expect(materialForName('MYGOLD_x')).toBeUndefined(); // prefix only, not substring
  });
  it('KEEP_ opts out of replacement', () => {
    expect(keepsOwnMaterial('KEEP_enamel_blue')).toBe(true);
    expect(keepsOwnMaterial('GOLD_frame')).toBe(false);
  });
});
