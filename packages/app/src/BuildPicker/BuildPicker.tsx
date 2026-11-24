import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';

import type { Named } from '@/engine/protocol';

export type BuildPickerProps = {
  readonly weapons: readonly Named[];
  readonly weaponId: string;
  /** Those that fit the weapon. */
  readonly modules: readonly Named[];
  readonly moduleIds: readonly string[];
  readonly onWeaponChange: (id: string) => void;
  readonly onModulesChange: (ids: readonly string[]) => void;
};

export const BuildPicker = (props: BuildPickerProps) => {
  const { weapons, weaponId, modules, moduleIds, onWeaponChange, onModulesChange } = props;
  return (
    <section aria-label="Build">
      <Select
        value={weaponId}
        onChange={(key) => {
          onWeaponChange(String(key));
        }}
      >
        <Label>Weapon</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox items={weapons}>{({ name }) => <ListBoxItem>{name}</ListBoxItem>}</ListBox>
        </Popover>
      </Select>
      <h2 id="mods">Mods</h2>
      <ListBox
        aria-labelledby="mods"
        items={modules}
        selectionMode="multiple"
        selectedKeys={moduleIds}
        onSelectionChange={(keys) => {
          onModulesChange(keys === 'all' ? modules.map(({ id }) => id) : [...keys].map(String));
        }}
      >
        {({ name }) => (
          <ListBoxItem textValue={name}>
            {({ isSelected }) => (isSelected ? `\u2713 ${name}` : name)}
          </ListBoxItem>
        )}
      </ListBox>
    </section>
  );
};
