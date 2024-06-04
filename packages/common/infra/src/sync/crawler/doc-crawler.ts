import { applyUpdate, Doc as YDoc } from 'yjs';

import { Document } from '../indexer';
import type { docIndexSchema } from './schema';

export function crawlingDocData(docId: string, docBuffer: Uint8Array) {
  const ydoc = new YDoc();

  applyUpdate(ydoc, docBuffer);

  const blocks = ydoc.getMap<any>('blocks');

  if (blocks.size === 0) {
    return;
  }

  let docTitle = '';

  for (const block of blocks.values()) {
    if (block.get('sys:flavour') === 'affine:page') {
      docTitle = block.get('prop:title').toString();
    }
  }

  return {
    doc: Document.from<typeof docIndexSchema>(docId, {
      title: docTitle,
    }),
  };
}
