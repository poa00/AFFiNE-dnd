import { AsyncPriorityQueue } from './async-priority-queue';

export interface CrawlerJob<JobInfo> {
  jobInfo?: JobInfo;
  timestamp: number;
}

export interface Crawler<CrawlerJobInfo = undefined> {
  crawl(
    id: string,
    jobs: CrawlerJob<CrawlerJobInfo>[],
    signal: AbortSignal,
    scheduler: CrawlerScheduler<CrawlerJobInfo>
  ): Promise<void>;
}

export class CrawlerScheduler<CrawlerJobInfo> {
  constructor(private readonly crawler: Crawler<CrawlerJobInfo>) {}

  queue = new AsyncPriorityQueue();
  jobs = new Map<string, CrawlerJob<CrawlerJobInfo>[]>();
  prioritySettings = new Map<string, number>();

  requestRevaluate(id: string, jobInfo?: CrawlerJobInfo) {
    const priority = this.prioritySettings.get(id) ?? 0;
    this.queue.push(id, priority);
    const jobs = this.jobs.get(id) ?? [];
    jobs.push({ jobInfo: jobInfo, timestamp: Date.now() });
    this.jobs.set(id, jobs);
  }

  setPriority(id: string, priority: number) {
    this.prioritySettings.set(id, priority);
  }

  remove(id: string) {
    this.queue.remove(id);
    this.jobs.delete(id);
  }

  async crawl(signal: AbortSignal) {
    const id = await this.queue.asyncPop();
    const jobs = this.jobs.get(id) ?? [];
    this.jobs.delete(id);

    if (jobs.length > 0) {
      await this.crawler.crawl(id, jobs, signal, this);
    }
    return;
  }
}
