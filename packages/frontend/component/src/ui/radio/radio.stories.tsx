import { AiIcon, FrameIcon, TocIcon, TodayIcon } from '@blocksuite/icons';
import { cssVar } from '@toeverything/theme';
import { useState } from 'react';

import { ResizePanel } from '../resize-panel/resize-panel';
import { Radio } from './radio';
import type { RadioItem } from './types';

export default {
  title: 'UI/Radio',
};

export const FixedWidth = () => {
  const [value, setValue] = useState('Radio 1');
  return (
    <>
      <p style={{ marginBottom: 10, fontSize: cssVar('fontXs') }}>
        width:&nbsp;
        <code
          style={{
            padding: '2px 4px',
            borderRadius: 3,
            background: cssVar('hoverColorFilled'),
          }}
        >
          300px
        </code>
      </p>
      <Radio
        width={300}
        value={value}
        onChange={setValue}
        items={['Radio 1', 'Radio 2, Longer', 'S3']}
      />
    </>
  );
};

export const AutoWidth = () => {
  const [value, setValue] = useState('Radio 1');
  return (
    <Radio
      value={value}
      onChange={setValue}
      items={['Radio 1', 'Radio 2, Longer', 'S3']}
    />
  );
};

export const DynamicWidth = () => {
  const [value, setValue] = useState('Radio 1');
  return (
    <ResizePanel
      horizontal
      vertical={false}
      maxWidth={1080}
      minWidth={235}
      width={250}
    >
      <Radio
        width="100%"
        value={value}
        onChange={setValue}
        items={['Radio 1', 'Radio 2, Longer', 'S3']}
      />
    </ResizePanel>
  );
};

export const IconTabs = () => {
  const [value, setValue] = useState('ai');
  const items: RadioItem[] = [
    {
      value: 'ai',
      label: <AiIcon width={20} height={20} />,
      style: { width: 28 },
    },
    {
      value: 'calendar',
      label: <TodayIcon width={20} height={20} />,
      style: { width: 28 },
    },
    {
      value: 'outline',
      label: <TocIcon width={20} height={20} />,
      style: { width: 28 },
    },
    {
      value: 'frame',
      label: <FrameIcon width={20} height={20} />,
      style: { width: 28 },
    },
  ];
  return (
    <Radio
      value={value}
      onChange={setValue}
      items={items}
      padding={4}
      borderRadius={12}
      gap={8}
    />
  );
};
