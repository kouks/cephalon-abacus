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

export type TargetPickerProps = {
  readonly targets: readonly Named[];
  readonly targetId: string;
  readonly onTargetChange: (id: string) => void;
};

export const TargetPicker = ({ targets, targetId, onTargetChange }: TargetPickerProps) => (
  <Select
    value={targetId}
    onChange={(key) => {
      onTargetChange(String(key));
    }}
  >
    <Label>Target</Label>
    <Button>
      <SelectValue />
    </Button>
    <Popover>
      <ListBox items={targets}>{({ name }) => <ListBoxItem>{name}</ListBoxItem>}</ListBox>
    </Popover>
  </Select>
);
