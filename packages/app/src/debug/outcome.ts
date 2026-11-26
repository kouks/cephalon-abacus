import { assertNever } from '@abacus/data/assert';
import type { Result } from '@abacus/engine';

import type { Reply } from '@/engine/protocol';
import { formatDamage } from '@/format/numbers';

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
      readonly warnings: readonly string[];
      readonly rows: readonly TraceRow[];
      readonly json: string;
    };

/** JSON has no maps and no infinity. */
const toJson = (_key: string, value: unknown): unknown => {
  if (value instanceof Map) return Object.fromEntries(value as ReadonlyMap<string, unknown>);
  return value === Infinity ? 'Infinity' : value;
};

const headlineOf = ({ perShot, burstDps, sustainedDps, lifetimeDamage }: Result) => [
  { label: 'Per shot', value: formatDamage(perShot) },
  { label: 'Burst DPS', value: formatDamage(burstDps) },
  { label: 'Sustained DPS', value: formatDamage(sustainedDps) },
  { label: 'Lifetime damage', value: formatDamage(lifetimeDamage) },
];

const LAYER_NAMES = { overguard: 'Overguard', shield: 'Shields', health: 'Health' } as const;

const enemyOf = ({ enemy, layer }: Result): readonly HeadlineNumber[] =>
  enemy === undefined
    ? []
    : [
        { label: 'Hits meet', value: LAYER_NAMES[layer] },
        { label: 'Level', value: formatDamage(enemy.level) },
        { label: 'Health', value: formatDamage(enemy.health.value) },
        { label: 'Shields', value: formatDamage(enemy.shield.value) },
        { label: 'Armor', value: formatDamage(enemy.armor.value) },
        { label: 'Overguard', value: formatDamage(enemy.overguard.value) },
      ];

const outcomeOfResult = (result: Result): Outcome => ({
  kind: 'result',
  headline: headlineOf(result),
  enemy: enemyOf(result),
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
