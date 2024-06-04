import type { DocStorage } from '../doc';
import type { JobQueue } from '../job';

interface CrawlerJobPayload {
  docId: string;
}

export class CrawlerEngine {
  constructor(
    private readonly jobQueue: JobQueue<CrawlerJobPayload>,
    private readonly docStorage: DocStorage
  ) {}
}
