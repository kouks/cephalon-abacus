/** A hit on a target, from mods to the factor chain. */
import { must } from '@abacus/data/assert';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { DamageTypeRule } from '@abacus/data/schema/damageTypeRule';
import type { Faction } from '@abacus/data/schema/faction';
import { factionSchema } from '@abacus/data/schema/faction';
import type { Scenario } from '@abacus/data/schema/scenario';
import { faction, weapon } from '@abacus/data/testing/fixtures';

import type { Assumptions } from '@/assumptions';
import { buildAttack } from '@/build/buildAttack';
import type { Loadout } from '@/build/loadout';
import { makeLoadout } from '@/build/loadout';
import type { TierDealt } from '@/resolve/dealtOnLayers';
import { dealtOnLayers } from '@/resolve/dealtOnLayers';
import type { Defence } from '@/resolve/defence';
import { expectedShot } from '@/resolve/expectedShot';
import type { HitResult } from '@/resolve/resolveHit';
import { resolveHit } from '@/resolve/resolveHit';
import type { Roller } from '@/resolve/roller';
import type { Taken } from '@/resolve/taken';
import { withTaken } from '@/resolve/taken';
import type { Target, TargetPart } from '@/resolve/target';
import type { FactorName } from '@/trace/hitTrace';

import { makeLibrary, makeScenario } from './build';

type Setup = {
  readonly modules?: readonly { readonly id: string }[];
  readonly attack?: object;
  readonly weaponChange?: object;
  readonly build?: object;
  readonly assumptions?: Partial<Assumptions>;
  readonly target?: Target;
  readonly distance?: number;
  readonly missBy?: number;
  readonly defence?: Defence;
  /** What statuses on the enemy do to the hit. */
  readonly taken?: readonly Taken[];
  readonly roller?: Roller;
};

const [baseAttack] = weapon.attacks;

export const BODY: TargetPart = { multiplier: 1, bodyParts: [] };
export const HEAD: TargetPart = { multiplier: 3, bodyParts: ['head', 'weakPoint'], headcrit: 2 };
export const WEAK_POINT: TargetPart = { multiplier: 1, bodyParts: ['weakPoint'] };

export const makeTarget = (change: Partial<Target> = {}): Target => ({
  id: 'dummy',
  name: 'Dummy',
  parts: new Map([
    ['body', BODY],
    ['head', HEAD],
    ['backpack', WEAK_POINT],
  ]),
  ...change,
});

const { id, name, source, gameVersion } = faction;

/** A faction with no weaknesses, and no bonuses of its own, unless it is given some. */
export const makeFaction = (change: object): Faction =>
  factionSchema.parse({ id, name, source, gameVersion, damageProfile: {}, ...change });

export const loadoutOf = ({
  modules = [],
  attack = {},
  weaponChange = {},
  ...rest
}: Setup): Loadout => {
  const attacks = [{ ...baseAttack, ...attack }];
  const ids = modules.map(({ id }) => ({ moduleId: id }));
  return makeLoadout(
    makeScenario(ids, rest.build),
    makeLibrary(modules, { attacks, ...weaponChange }),
    rest.assumptions,
  );
};

/** One hit of the test rifle: 103.125 damage, 20% crit at 2x. */
export const hit = (setup: Setup = {}, part: TargetPart = BODY): HitResult => {
  const loadout = loadoutOf(setup);
  const attack = must(loadout.weapon.attacks[0], 'no attack');
  const built = withTaken(
    buildAttack(loadout, attack, { bodyParts: part.bodyParts }),
    setup.taken ?? [],
  );
  const { target = makeTarget(), distance = 10, missBy, defence, roller } = setup;
  return resolveHit(built, { target, part, distance, missBy, defence, roller });
};

/** What one hit of each crit tier of the test rifle shows and applies on the defence's layers. */
export const dealt = (
  setup: Setup & { readonly defence: Defence },
  part: TargetPart = BODY,
): readonly TierDealt[] => {
  const loadout = loadoutOf(setup);
  const attack = must(loadout.weapon.attacks[0], 'no attack');
  const built = withTaken(
    buildAttack(loadout, attack, { bodyParts: part.bodyParts }),
    setup.taken ?? [],
  );
  const { target = makeTarget(), distance = 10, missBy } = setup;
  return dealtOnLayers(built, { target, part, distance, missBy }, setup.defence);
};

const rule = (layers: DamageTypeRule['layers'], bypassArmor = false) =>
  ({ layers, bypassArmor }) as unknown as DamageTypeRule;

const ALL = { overguard: 1, shield: 1, health: 1 };

/** The test rifle's three types, as damageTypes.json has them, and a few others. */
export const LAYER_RULES = new Map<DamageType, DamageTypeRule>([
  ['impact', rule(ALL)],
  ['puncture', rule(ALL)],
  ['slash', rule(ALL)],
  ['toxin', rule({ overguard: 1, health: 1 })],
  ['void', rule({ ...ALL, overguard: 1.5 })],
  ['true', rule({ overguard: 1, health: 1 }, true)],
  ['cinematic', rule(ALL, true)],
  ['gas', rule(ALL)],
]);

/** One shot of the test rifle, on average. */
export const shot = (setup: Setup & { readonly aim: Scenario['aim'] }) => {
  const loadout = loadoutOf(setup);
  const attack = must(loadout.weapon.attacks[0], 'no attack');
  return expectedShot({
    buildFor: (bodyParts) => buildAttack(loadout, attack, { bodyParts }),
    target: setup.target ?? makeTarget(),
    aim: setup.aim,
    distance: setup.distance ?? 10,
  });
};

/** A factor of a hit. */
export const factorOf = ({ trace }: HitResult, name: FactorName, type?: DamageType) =>
  must(
    trace.factors.find((entry) => entry.name === name && entry.type === type),
    `No factor "${name}"`,
  );
