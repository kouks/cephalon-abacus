import type { Scenario } from '@abacus/data/schema/scenario';
import { scenarioSchema } from '@abacus/data/schema/scenario';

const DEFAULT_SCENARIO: Scenario = {
  build: {
    weaponId: 'braton',
    modules: [],
    conditionals: { all: 'on', overrides: [] },
    elementOrder: [],
  },
  enemy: { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [] },
  aim: { head: 0, body: 1 },
  distance: 10,
  duration: 20,
  mode: 'expected',
};

const textOf = (scenario: Scenario) => JSON.stringify(scenario, null, 2);

/** What the page starts with. */
export const DEFAULT_TEXT = textOf(DEFAULT_SCENARIO);

export type ParsedText =
  | { readonly isJson: true; readonly value: unknown }
  | { readonly isJson: false; readonly problem: string };

export const parseText = (text: string): ParsedText => {
  try {
    return { isJson: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { isJson: false, problem: error instanceof Error ? error.message : String(error) };
  }
};

/** The scenario a text holds, or the default one if it holds none. */
export const scenarioIn = (text: string): Scenario => {
  const parsed = parseText(text);
  const scenario = scenarioSchema.safeParse(parsed.isJson ? parsed.value : undefined);
  return scenario.success ? scenario.data : DEFAULT_SCENARIO;
};

/** The same text with another weapon, which keeps the modules that fit it. */
export const withWeapon = (text: string, weaponId: string, fitting: readonly string[]): string => {
  const { build, ...rest } = scenarioIn(text);
  const { modules, conditionals, elementOrder } = build;
  const kept = modules.filter(({ moduleId }) => fitting.includes(moduleId));
  return textOf({ ...rest, build: { weaponId, modules: kept, conditionals, elementOrder } });
};

/** The same text with these modules. Those it already had keep their place and rank. */
export const withModules = (text: string, ids: readonly string[]): string => {
  const { build, ...rest } = scenarioIn(text);
  const kept = build.modules.filter(({ moduleId }) => ids.includes(moduleId));
  const added = ids
    .filter((id) => !kept.some(({ moduleId }) => moduleId === id))
    .map((moduleId) => ({ moduleId }));
  return textOf({ ...rest, build: { ...build, modules: [...kept, ...added] } });
};
