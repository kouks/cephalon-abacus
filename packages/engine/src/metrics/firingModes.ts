import { must } from '@abacus/data/assert';
import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

/** The attacks a player can fire. The others are set off by one of these: a grenade's explosion. */
export const firingModes = ({ attacks }: Weapon): readonly Attack[] => {
  const linked = new Set(attacks.flatMap(({ linkedAttacks = [] }) => linkedAttacks));
  const modes = attacks.filter(({ id }) => !linked.has(id));
  return modes.length > 0 ? modes : [must(attacks[0], 'The schema requires an attack')];
};

/** An attack, and everything it sets off, each once. */
export const withLinked = (first: Attack, { attacks }: Weapon): readonly Attack[] => {
  const chain = [first];
  for (const { linkedAttacks = [] } of chain) {
    const next = attacks.filter(({ id }) => linkedAttacks.includes(id));
    chain.push(...next.filter((attack) => !chain.includes(attack)));
  }
  return chain;
};
