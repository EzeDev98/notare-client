import { Inbox } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  ChipSelect,
  DetailRow,
  EmptyState,
  ProgressBar,
  Skeleton,
  Steps,
  Tag,
} from '@/design-system/ui';

import { Both } from './Both';

const SORT = [
  { value: 'updated', label: 'Updated' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
] as const;

function ChipDemo({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('updated');
  return (
    <ChipSelect
      label="Sort notes by"
      name={disabled ? 'gallery-sort-disabled' : 'gallery-sort'}
      options={SORT}
      value={value}
      onChange={setValue}
      disabled={disabled}
    />
  );
}

/** Gallery: row 5, Card, DetailRow, Tag, Badge, ChipSelect, Steps, ProgressBar, Skeleton, EmptyState. */
export function Row5() {
  return (
    <>
      <h2 className="gallery-group">Row 5: Card, DetailRow, Tag, Badge, Chips, Steps, Progress, Skeleton, EmptyState</h2>
      <Both title="Card with DetailRow">
        <Card>
          <DetailRow label="Created">Today, 09:41</DetailRow>
          <DetailRow label="Last edited">2 minutes ago</DetailRow>
          <DetailRow label="Words">184</DetailRow>
        </Card>
      </Both>
      <Both title="Tag and Badge">
        <div className="gallery-row">
          <Tag>Pinned</Tag>
          <Tag tone="brand">Shared</Tag>
          <Badge>1</Badge>
          <Badge>12</Badge>
          <Badge>120</Badge>
        </div>
      </Both>
      <Both title="Chips (arrow keys move, chosen is filled), disabled">
        <div className="gallery-stack">
          <ChipDemo />
          <ChipDemo disabled />
        </div>
      </Both>
      <Both title="Steps">
        <div className="gallery-stack">
          <Steps current={1} total={2} />
          <Steps current={2} total={2} />
          <Steps current={2} total={4} />
        </div>
      </Both>
      <Both title="Progress bar (0, 40, 90, 100)">
        <div className="gallery-stack">
          <ProgressBar value={0} label="Empty" />
          <ProgressBar value={40} label="Forty percent" />
          <ProgressBar value={90} label="Ninety percent" />
          <ProgressBar value={100} label="Complete" />
        </div>
      </Both>
      <Both title="Skeleton (loading)">
        <Skeleton rows={3} />
      </Both>
      <Both title="EmptyState: with button, without">
        <Card>
          <EmptyState
            icon={Inbox}
            title="No notes yet"
            description="Your first note appears here as soon as you write something."
            action={<Button>New note</Button>}
          />
          <EmptyState icon={Inbox} title="Nothing archived" />
        </Card>
      </Both>
    </>
  );
}
