import { DebugLogger } from '@affine/debug';

import type { DocEngine } from '../doc';
import { type IndexStorage } from '../indexer';
import type { Job, JobQueue } from '../job';
import { JobRunner } from '../job';
import { crawlingDocData } from './doc-crawler';
import { blockIndexSchema, docIndexSchema } from './schema';

const logger = new DebugLogger('crawler');

interface CrawlerJobPayload {
  docId: string;
}

export class CrawlerEngine {
  private readonly runner = new JobRunner(this.jobQueue, (jobs, signal) =>
    this.execJob(jobs, signal)
  );

  private readonly docIndex =
    this.indexProvider.getIndex<typeof docIndexSchema>('doc');

  private readonly blockIndex =
    this.indexProvider.getIndex<typeof blockIndexSchema>('block');

  private indexInitialized: Promise<void> | null = null;
  private jobQueueInitialized: Promise<void> | null = null;

  constructor(
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

        (async () => {
          await this.initializeJobQueue();
          await this.jobQueue.enqueue([
            {
              batchKey: docId,
              payload: { docId },
            },
          ]);
        })().catch(err => {
          console.error('Error enqueueing job', err);
        });
      }
    });
  }

  startCrawling() {
    this.runner.start();
  }

  stopCrawling() {
    this.runner.stop();
  }

  async initializeIndex() {
    if (this.indexInitialized) {
      return await this.indexInitialized;
    }

    this.indexInitialized = (async () => {
      await this.docIndex.initialize(docIndexSchema);
      await this.blockIndex.initialize(blockIndexSchema);
    })();

    await this.indexInitialized;
  }

  async initializeJobQueue() {
    if (this.jobQueueInitialized) {
      return await this.jobQueueInitialized;
    }

    this.jobQueueInitialized = this.jobQueue.initialize();
    return await this.jobQueueInitialized;
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
      const result = crawlingDocData(docId, buffer);

      if (!result) {
        return;
      }

      await this.initializeIndex();
      const indexWriter = await this.docIndex.write();
      indexWriter.put(result.doc);
      await indexWriter.commit();
    }
  }
}
