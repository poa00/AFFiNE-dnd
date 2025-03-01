import { AffineSchemas, SpecProvider, TestUtils } from '@blocksuite/blocks';
import type { BlockSuiteFlags } from '@blocksuite/global/types';
import { nanoid, Schema, Transformer } from '@blocksuite/store';
import {
  createAutoIncrementIdGenerator,
  type DocCollectionOptions,
  TestWorkspace,
} from '@blocksuite/store/test';
import {
  type BlobSource,
  BroadcastChannelAwarenessSource,
  BroadcastChannelDocSource,
  IndexedDBBlobSource,
  MemoryBlobSource,
} from '@blocksuite/sync';
import * as Y from 'yjs';

import { MockServerBlobSource } from '../../_common/sync/blob/mock-server.js';
import type { InitFn } from '../data/utils.js';

const params = new URLSearchParams(location.search);
const room = params.get('room');
const isE2E = room?.startsWith('playwright');
const blobSourceArgs = (params.get('blobSource') ?? '').split(',');

export function createStarterDocCollection() {
  const collectionId = room ?? 'starter';
  const schema = new Schema();
  schema.register(AffineSchemas);
  const idGenerator = isE2E ? createAutoIncrementIdGenerator() : nanoid;

  let docSources: DocCollectionOptions['docSources'];
  if (room) {
    docSources = {
      main: new BroadcastChannelDocSource(`broadcast-channel-${room}`),
    };
  }
  const id = room ?? `starter-${Math.random().toString(16).slice(2, 8)}`;

  const blobSources = {
    main: new MemoryBlobSource(),
    shadows: [] as BlobSource[],
  } satisfies DocCollectionOptions['blobSources'];
  if (blobSourceArgs.includes('mock')) {
    blobSources.shadows.push(new MockServerBlobSource(collectionId));
  }
  if (blobSourceArgs.includes('idb')) {
    blobSources.shadows.push(new IndexedDBBlobSource(collectionId));
  }

  const flags: Partial<BlockSuiteFlags> = Object.fromEntries(
    Array.from(params.entries())
      .filter(([key]) => key.startsWith('enable_'))
      .map(([k, v]) => [k, v === 'true'])
  );

  const options: DocCollectionOptions = {
    id: collectionId,
    schema,
    idGenerator,
    defaultFlags: {
      enable_synced_doc_block: true,
      enable_pie_menu: true,
      enable_lasso_tool: true,
      enable_edgeless_text: true,
      enable_color_picker: true,
      enable_mind_map_import: true,
      enable_advanced_block_visibility: true,
      enable_shape_shadow_blur: false,
      ...flags,
    },
    awarenessSources: [new BroadcastChannelAwarenessSource(id)],
    docSources,
    blobSources,
  };
  const collection = new TestWorkspace(options);
  collection.storeExtensions =
    SpecProvider.getInstance().getSpec('store').value;
  collection.start();

  // debug info
  window.collection = collection;
  window.blockSchemas = AffineSchemas;
  window.job = new Transformer({
    schema: collection.schema,
    blobCRUD: collection.blobSync,
    docCRUD: {
      create: (id: string) => collection.createDoc({ id }),
      get: (id: string) => collection.getDoc(id),
      delete: (id: string) => collection.removeDoc(id),
    },
  });
  window.Y = Y;
  window.testUtils = new TestUtils();

  return collection;
}

export async function initStarterDocCollection(collection: TestWorkspace) {
  // use built-in init function
  const functionMap = new Map<
    string,
    (collection: TestWorkspace, id: string) => Promise<void> | void
  >();
  Object.values(
    (await import('../data/index.js')) as Record<string, InitFn>
  ).forEach(fn => functionMap.set(fn.id, fn));
  const init = params.get('init') || 'preset';
  if (functionMap.has(init)) {
    collection.meta.initialize();
    await functionMap.get(init)?.(collection, 'doc:home');
    const doc = collection.getDoc('doc:home');
    if (!doc?.loaded) {
      doc?.load();
    }
    doc?.resetHistory();
  }
}
