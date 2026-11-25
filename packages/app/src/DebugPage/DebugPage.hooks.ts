import { useEffect, useState } from 'react';

import { outcomeOf } from '@/debug/outcome';
import {
  DEFAULT_TEXT,
  parseText,
  scenarioIn,
  withModules,
  withTarget,
  withWeapon,
} from '@/debug/scenarioText';
import type { Engine } from '@/engine/connectEngine';
import type { Catalog, Reply } from '@/engine/protocol';

const NOTHING: Catalog = { weapons: [], targets: [] };

/** What the engine has to say: what can be picked, and the answer to the text. */
const useEngine = (engine: Engine, text: string) => {
  const [catalog, setCatalog] = useState(NOTHING);
  const [reply, setReply] = useState<Reply>();

  useEffect(() => {
    engine.catalog().then(setCatalog, (error: unknown) => {
      setReply({ status: 'failed', message: String(error) });
    });
  }, [engine]);

  useEffect(() => {
    const parsed = parseText(text);
    if (!parsed.isJson) return;
    void engine.evaluate(parsed.value).then((next) => {
      if (next !== undefined) setReply(next);
    });
  }, [engine, text]);

  return { catalog, reply };
};

export const useDebugPage = (engine: Engine) => {
  const [text, setText] = useState(DEFAULT_TEXT);
  const { catalog, reply } = useEngine(engine, text);
  const { weapons, targets } = catalog;
  const { build, enemy } = scenarioIn(text);
  const { weaponId, modules } = build;
  const modulesFor = (id: string) => weapons.find((weapon) => weapon.id === id)?.modules ?? [];

  const handleWeaponChange = (id: string) => {
    const fitting = modulesFor(id).map((module) => module.id);
    setText(withWeapon(text, id, fitting));
  };

  const handleModulesChange = (ids: readonly string[]) => {
    setText(withModules(text, ids));
  };

  const handleTargetChange = (id: string) => {
    setText(withTarget(text, id));
  };

  return {
    weapons,
    weaponId,
    modules: modulesFor(weaponId),
    moduleIds: modules.map(({ moduleId }) => moduleId),
    targets,
    targetId: enemy.id,
    text,
    outcome: outcomeOf(parseText(text), reply),
    handleWeaponChange,
    handleModulesChange,
    handleTargetChange,
    handleTextChange: setText,
  };
};
