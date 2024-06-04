import type { Schema } from '../indexer';

export const docIndexSchema = {
  title: 'FullText',
} satisfies Schema;

export const blockIndexSchema = {
  docId: 'String',
  blockId: 'String',
  content: 'FullText',
} satisfies Schema;
