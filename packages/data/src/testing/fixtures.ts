/** Made-up items for tests: small, valid, and no part of the real library. */

const item = (id: string) => ({
  id,
  name: id,
  source: 'https://wiki.warframe.com/w/Test',
  gameVersion: '44.1.4.1',
});

export const attack = {
  id: 'normal',
  name: 'Normal attack',
  damage: { impact: 30, puncture: 30, slash: 40 },
  trigger: 'auto',
  shotType: 'hitscan',
  multishot: 1,
  critChance: 0.2,
  critMultiplier: 2,
  statusChance: 0.1,
  fireRate: 8,
  ammoCost: 1,
};

export const weapon = {
  ...item('test-rifle'),
  slot: 'primary',
  class: ['rifle'],
  maxRank: 30,
  ammo: { magazine: 45, maxAmmo: 540, reloadStyle: 'magazine', reloadTime: 2 },
  attacks: [attack],
};

export const module = {
  ...item('test-mod'),
  kind: 'mod',
  rank: { max: 10, perRank: 'linear' },
  compat: { slots: ['primary'], classes: ['rifle'] },
  effects: [{ bucket: 'damage.base', op: 'STACKING_MULTIPLY', value: 1.65 }],
};

export const enemy = {
  ...item('test-enemy'),
  faction: 'grineer',
  baseLevel: 1,
  baseHealth: 100,
  baseShield: 0,
  baseArmor: 0,
  baseOverguard: 0,
};

export const scenario = {
  build: { weaponId: 'test-rifle', modules: [{ moduleId: 'test-mod' }], elementOrder: [] },
  enemy: { id: 'test-enemy', level: 100, steelPath: false, modifiers: [] },
  aim: { head: 0.6, body: 0.4 },
  distance: 10,
  duration: 20,
  mode: 'expected',
};

/** A library file around some items. */
export const libraryFile = (path: string, ...items: readonly unknown[]) => ({
  path,
  text: JSON.stringify({
    schemaVersion: 1,
    gameVersion: '44.1.4.1',
    source: 'https://wiki.warframe.com/w/Test',
    items,
  }),
});
