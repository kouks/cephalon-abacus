import { assertNever } from '@abacus/data/assert';
import type { Result } from '@abacus/engine';

import type { Reply } from '@/engine/protocol';
import { formatDamage } from '@/format/numbers';

import { oneHitOf } from './oneHit';
import type { ParsedText } from './scenarioText';
import type { TraceRow } from './traceRows';
import { traceRows } from './traceRows';

export type HeadlineNumber = { readonly label: string; readonly value: string };

/** What the page has to show for a scenario. */
export type Outcome =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'problems'; readonly problems: readonly string[] }
  | {
      readonly kind: 'result';
      readonly headline: readonly HeadlineNumber[];
      /** The enemy's stats at its level. Empty for the neutral dummy. */
      readonly enemy: readonly HeadlineNumber[];
      /** What one hit of each colour shows and applies on each layer. Empty for the dummy. */
      readonly oneHit: readonly HeadlineNumber[];
      readonly warnings: readonly string[];
      readonly rows: readonly TraceRow[];
      readonly json: string;
    };

/** JSON has no maps and no infinity. */
const toJson = (_key: string, value: unknown): unknown => {
  if (value instanceof Map) return Object.fromEntries(value as ReadonlyMap<string, unknown>);
  return value === Infinity ? 'Infinity' : value;
};

type Headline = Result['dot'];

const NUMBERS = ['perShot', 'burstDps', 'sustainedDps', 'lifetimeDamage'] as const;

const DIRECT: Readonly<Record<keyof Headline, string>> = {
  perShot: 'Per shot',
  burstDps: 'Burst DPS',
  sustainedDps: 'Sustained DPS',
  lifetimeDamage: 'Lifetime damage',
};

const DOT: Readonly<Record<keyof Headline, string>> = {
  perShot: 'DoT per shot',
  burstDps: 'DoT burst DPS',
  sustainedDps: 'DoT sustained DPS',
  lifetimeDamage: 'DoT lifetime damage',
};

/** The four numbers of a headline, by these labels. */
const numbersOf = (
  headline: Headline,
  labels: Readonly<Record<keyof Headline, string>>,
): readonly HeadlineNumber[] =>
  NUMBERS.map((key) => ({ label: labels[key], value: formatDamage(headline[key]) }));

/** Direct damage, then what the procs deal over time, apart from it. */
const headlineOf = (result: Result) => [
  ...numbersOf(result, DIRECT),
  ...numbersOf(result.dot, DOT),
];

const LAYER_NAMES = { overguard: 'Overguard', shield: 'Shields', health: 'Health' } as const;

/** The armor the first hit met, where strips lowered it. */
const strippedOf = ({ enemy, trace }: Result): readonly HeadlineNumber[] => {
  const armor = trace[0]?.armor;
  if (armor === undefined || armor === enemy?.armor.value) return [];
  return [{ label: 'Armor after strips', value: formatDamage(armor) }];
};

const enemyOf = (result: Result): readonly HeadlineNumber[] => {
  const { enemy, layer } = result;
  if (enemy === undefined) return [];
  return [
    { label: 'Hits meet', value: LAYER_NAMES[layer] },
    { label: 'Level', value: formatDamage(enemy.level) },
    { label: 'Health', value: formatDamage(enemy.health.value) },
    { label: 'Shields', value: formatDamage(enemy.shield.value) },
    { label: 'Armor', value: formatDamage(enemy.armor.value) },
    ...strippedOf(result),
    { label: 'Overguard', value: formatDamage(enemy.overguard.value) },
  ];
};

const outcomeOfResult = (result: Result): Outcome => ({
  kind: 'result',
  headline: headlineOf(result),
  enemy: enemyOf(result),
  oneHit: oneHitOf(result),
  warnings: result.warnings.map((warning) => JSON.stringify(warning)),
  rows: traceRows(result),
  json: JSON.stringify(result, toJson, 2),
});

export const outcomeOf = (text: ParsedText, reply: Reply | undefined): Outcome => {
  if (!text.isJson) return { kind: 'problems', problems: [text.problem] };
  if (reply === undefined) return { kind: 'waiting' };
  switch (reply.status) {
    case 'evaluated':
      return outcomeOfResult(reply.result);
    case 'invalid':
      return { kind: 'problems', problems: reply.problems };
    case 'failed':
      return { kind: 'problems', problems: [reply.message] };
    default:
      return assertNever(reply);
  }
};
