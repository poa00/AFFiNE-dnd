import '../../_common/components/ask-ai-button';

import {
  type AffineFormatBarWidget,
  toolbarDefaultConfig,
} from '@blocksuite/affine/blocks';
import { html, type TemplateResult } from 'lit';

import { pageAIGroups } from '../../_common/config';

export function setupFormatBarAIEntry(formatBar: AffineFormatBarWidget) {
  toolbarDefaultConfig(formatBar);
  formatBar.addRawConfigItems(
    [
      {
        type: 'custom' as const,
        render(formatBar: AffineFormatBarWidget): TemplateResult | null {
          return html`
            <ask-ai-toolbar-button
              .host=${formatBar.host}
              .actionGroups=${pageAIGroups}
            ></ask-ai-toolbar-button>
          `;
        },
      },
      { type: 'divider' },
    ],
    0
  );
}
