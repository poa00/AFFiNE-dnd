import { DebugLogger } from '@affine/debug';
import { difference } from 'lodash-es';
import type { Array as YArray, Map as YMap } from 'yjs';
import { applyUpdate, Doc as YDoc } from 'yjs';

import type { DocEngine } from '../doc';
import { Document, type IndexStorage } from '../indexer';
import type { Job, JobQueue } from '../job';
import { JobRunner } from '../job';
import { blockIndexSchema, docIndexSchema } from './schema';

const logger = new DebugLogger('crawler');

interface CrawlerJobPayload {
  docId: string;
}

export class CrawlerEngine {
  private readonly runner = new JobRunner(this.jobQueue, (jobs, signal) =>
    this.execJob(jobs, signal)
  );

  private readonly docIndex = this.indexProvider.getIndex(
    'doc',
    docIndexSchema
  );

  private readonly blockIndex = this.indexProvider.getIndex(
    'block',
    blockIndexSchema
  );

  constructor(
    private readonly workspaceId: string,
    private readonly jobQueue: JobQueue<CrawlerJobPayload>,
    private readonly docEngine: DocEngine,
    private readonly indexProvider: IndexStorage
  ) {
    this.setupListener();
  }

  setupListener() {
    this.docEngine.storage.eventBus.on(event => {
      if (event.clientId === this.docEngine.clientId) {
        const docId = event.docId;

        this.jobQueue
          .enqueue([
            {
              batchKey: docId,
              payload: { docId },
            },
          ])
          .catch(err => {
            console.error('Error enqueueing job', err);
          });
      }
    });
  }

  startCrawling() {
    this.runner.start();
    this.jobQueue
      .enqueue([
        {
          batchKey: this.workspaceId,
          payload: { docId: this.workspaceId },
        },
      ])
      .catch(err => {
        console.error('Error enqueueing job', err);
      });
  }

  stopCrawling() {
    this.runner.stop();
  }

  async execJob(jobs: Job<CrawlerJobPayload>[], _signal: AbortSignal) {
    if (jobs.length === 0) {
      return;
    }

    // jobs should have the same docId, so we just pick the first one
    const docId = jobs[0].payload.docId;

    logger.debug('Start crawling job for docId:', docId);

    if (docId) {
      const buffer = await this.docEngine.storage.loadDocFromLocal(docId);
      if (!buffer) {
        return;
      }
      if (docId === this.workspaceId) {
        await this.crawlingRootDocData();
      } else {
        await this.crawlingDocData(docId);
      }
    }
  }

  async quickSearch(content: string) {
    const result = await this.blockIndex.aggregate(
      {
        type: 'boolean',
        occur: 'must',
        queries: [
          {
            type: 'match',
            field: 'content',
            match: content,
          },
          {
            type: 'boolean',
            occur: 'should',
            queries: [
              {
                type: 'all',
              },
              {
                type: 'boost',
                boost: 100,
                query: {
                  type: 'match',
                  field: 'flavour',
                  match: 'affine:page',
                },
              },
            ],
          },
        ],
      },
      'docId',
      {
        pagination: {
          limit: 10,
          skip: 0,
        },
        hits: {
          fields: ['blockId', 'flavour'],
          highlights: [
            {
              field: 'content',
              before: '<b>',
              end: '</b>',
            },
          ],
        },
      }
    );

    const keys = result.buckets.map(bucket => bucket.key);

    const docData = await this.docIndex.getAll([...keys]);

    let str = '';

    for (const bucket of result.buckets) {
      const title = docData.find(doc => doc.id === bucket.key)?.get('title');
      str += `《${title}》 (${bucket.count} matches) \n`;
      for (const hit of bucket.hits?.nodes ?? []) {
        str += ` - ${hit.highlights.content.join(' ')} (${hit.fields.flavour}) \n`;
      }
    }
    console.log(str);
  }

  async crawlingDocData(docId: string) {
    const docBuffer = await this.docEngine.storage.loadDocFromLocal(docId);
    const rootDocBuffer = await this.docEngine.storage.loadDocFromLocal(
      this.workspaceId
    );
    if (!docBuffer) {
      return;
    }

    const ydoc = new YDoc();
    const yRootDoc = new YDoc();

    applyUpdate(ydoc, docBuffer);
    if (rootDocBuffer) {
      applyUpdate(yRootDoc, rootDocBuffer);
    }

    let docExists: boolean | null = null;

    (
      yRootDoc.getMap('meta').get('pages') as YArray<YMap<any>> | undefined
    )?.forEach(page => {
      if (page.get('id') === docId) {
        docExists = !(page.get('trash') ?? false);
      }
    });

    if (!docExists) {
      const indexWriter = await this.docIndex.write();
      indexWriter.delete(docId);
      await indexWriter.commit();

      const blockIndexWriter = await this.blockIndex.write();
      const oldBlocks = await blockIndexWriter.search(
        {
          type: 'match',
          field: 'docId',
          match: docId,
        },
        {
          pagination: {
            limit: Number.MAX_SAFE_INTEGER,
          },
        }
      );
      for (const block of oldBlocks.nodes) {
        blockIndexWriter.delete(block.id);
      }
      await blockIndexWriter.commit();
    } else {
      const blocks = ydoc.getMap<any>('blocks');

      if (blocks.size === 0) {
        return;
      }

      let docTitle = '';

      const blockDocuments: Document<typeof blockIndexSchema>[] = [];

      for (const block of blocks.values()) {
        const flavour = block.get('sys:flavour')?.toString();
        const blockId = block.get('sys:id')?.toString();

        if (!flavour || !blockId) {
          continue;
        }

        if (flavour === 'affine:page') {
          docTitle = block.get('prop:title').toString();
          blockDocuments.push(
            Document.from(`${docId}:${blockId}`, {
              docId,
              flavour,
              blockId,
              content: docTitle,
            })
          );
        }

        if (flavour === 'affine:paragraph') {
          blockDocuments.push(
            Document.from(`${docId}:${blockId}`, {
              docId,
              flavour,
              blockId,
              content: block.get('prop:text')?.toString(),
            })
          );
        }
      }

      const docIndexWriter = await this.docIndex.write();
      docIndexWriter.put(
        Document.from<typeof docIndexSchema>(docId, {
          title: docTitle,
        })
      );
      await docIndexWriter.commit();

      const blockIndexWriter = await this.blockIndex.write();
      const oldBlocks = await blockIndexWriter.search(
        {
          type: 'match',
          field: 'docId',
          match: docId,
        },
        {
          pagination: {
            limit: Number.MAX_SAFE_INTEGER,
          },
        }
      );
      for (const block of oldBlocks.nodes) {
        blockIndexWriter.delete(block.id);
      }
      for (const block of blockDocuments) {
        blockIndexWriter.insert(block);
      }
      await blockIndexWriter.commit();
    }
  }

  async crawlingRootDocData() {
    const buffer = await this.docEngine.storage.loadDocFromLocal(
      this.workspaceId
    );
    if (!buffer) {
      return;
    }

    const ydoc = new YDoc();

    applyUpdate(ydoc, buffer);

    const docs = ydoc.getMap('meta').get('pages') as
      | YArray<YMap<any>>
      | undefined;

    if (!docs) {
      return;
    }

    const availableDocs = [];

    for (const page of docs) {
      const docId = page.get('id');

      if (typeof docId !== 'string') {
        continue;
      }

      const inTrash = page.get('trash') ?? false;

      if (!inTrash) {
        availableDocs.push(docId);
      }
    }

    // a hack to get all docs in index
    const allIndexedDocs = (
      await this.docIndex.search(
        {
          type: 'all',
        },
        {
          pagination: {
            limit: Number.MAX_SAFE_INTEGER,
            skip: 0,
          },
        }
      )
    ).nodes.map(n => n.id);

    const needAdd = difference(allIndexedDocs, availableDocs);
    const needDelete = difference(availableDocs, allIndexedDocs);

    await this.jobQueue.enqueue(
      [...needAdd, ...needDelete].map(docId => ({
        batchKey: docId,
        payload: { docId },
      }))
    );
  }
}
