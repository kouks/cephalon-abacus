import { Label, TextArea, TextField } from 'react-aria-components';

import { BuildPicker } from '@/BuildPicker/BuildPicker';
import type { Engine } from '@/engine/connectEngine';
import { ResultView } from '@/ResultView/ResultView';
import { TargetPicker } from '@/TargetPicker/TargetPicker';

import { useDebugPage } from './DebugPage.hooks';

export type DebugPageProps = { readonly engine: Engine };

export const DebugPage = ({ engine }: DebugPageProps) => {
  const page = useDebugPage(engine);
  return (
    <>
      <BuildPicker
        weapons={page.weapons}
        weaponId={page.weaponId}
        modules={page.modules}
        moduleIds={page.moduleIds}
        onWeaponChange={page.handleWeaponChange}
        onModulesChange={page.handleModulesChange}
      />
      <TargetPicker
        targets={page.targets}
        targetId={page.targetId}
        onTargetChange={page.handleTargetChange}
      />
      <TextField value={page.text} onChange={page.handleTextChange}>
        <Label>Scenario, as JSON</Label>
        <div>
          <TextArea rows={24} cols={80} spellCheck={false} />
        </div>
      </TextField>
      <ResultView outcome={page.outcome} />
    </>
  );
};
