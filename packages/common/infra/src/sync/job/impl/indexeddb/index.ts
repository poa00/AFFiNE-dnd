import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

import { throwIfAborted } from '../../../../utils';
import type { Job, JobParams, JobQueue } from '../../';

interface IndexDB extends DBSchema {
  jobs: {
    key: number;
    value: JobRecord;
    indexes: {
      batchKey: string;
    };
  };
}

interface JobRecord {
  batchKey: string;
  startTime: number | null;
  payload: any;
}

export class IndexedDBJobQueue<J> implements JobQueue<J> {
  database: IDBPDatabase<IndexDB> = null as any;
  priorityMap = new Map<string, number>();
  broadcast = new BroadcastChannel('idb-job-queue:' + this.databaseName);

  constructor(private readonly databaseName: string = 'jobs') {}

  async enqueue(jobs: JobParams[]): Promise<void> {
    await this.ensureInitialized();
    const trx = this.database.transaction(['jobs'], 'readwrite');

    for (const job of jobs) {
      await trx.objectStore('jobs').add({
        batchKey: job.batchKey,
        payload: job.payload,
        startTime: null,
      });
    }

    trx.commit();

    // send broadcast to notify new jobs
    this.broadcast.postMessage('new-jobs');
  }

  async accept(): Promise<Job[] | null> {
    await this.ensureInitialized();
    const jobs = [];
    const trx = this.database.transaction(['jobs'], 'readwrite');

    for (const [batchKey, _] of Array.from(this.priorityMap.entries()).sort(
      (a, b) => b[1] - a[1]
    )) {
      const jobIds = await trx
        .objectStore('jobs')
        .index('batchKey')
        .getAllKeys(batchKey);

      for (const id of jobIds) {
        const job = await trx.objectStore('jobs').get(id);
        if (job && this.isAcceptable(job)) {
          jobs.push({ id, job });
        }
      }

      if (jobs.length === 0) {
        continue;
      }

      break;
    }

    // if no priority jobs

    if (jobs.length === 0) {
      const batchKeys = trx.objectStore('jobs').index('batchKey').iterate();

      let acceptedBatchKey: string | null = null;

      for await (const item of batchKeys) {
        if (
          acceptedBatchKey !== null &&
          item.value.batchKey !== acceptedBatchKey
        ) {
          break;
        }
        if (this.isAcceptable(item.value)) {
          jobs.push({
            id: item.primaryKey,
            job: item.value,
          });
          acceptedBatchKey = item.value.batchKey;
        }
      }
    }

    for (const { id, job } of jobs) {
      const startTime = Date.now();
      await trx.objectStore('jobs').put({ ...job, startTime }, id);
    }

    if (jobs.length === 0) {
      return null;
    }

    return jobs.map(({ id, job }) => ({
      id: id.toString(),
      batchKey: job.batchKey,
      payload: job.payload,
    }));
  }

  async waitForAccept(signal: AbortSignal): Promise<Job<J>[]> {
    const broadcast = new BroadcastChannel(
      'idb-job-queue:' + this.databaseName
    );

    try {
      let deferred = defer();

      deferred.resolve();

      broadcast.onmessage = () => {
        deferred.resolve();
      };

      while (throwIfAborted(signal)) {
        await Promise.race([
          deferred.promise,
          new Promise((_, reject) => {
            // exit if manually stopped
            if (signal?.aborted) {
              reject(signal.reason);
            }
            signal?.addEventListener('abort', () => {
              reject(signal.reason);
            });
          }),
        ]);
        deferred = defer();
        const jobs = await this.accept();
        if (jobs !== null) {
          return jobs;
        }
      }
      return [];
    } finally {
      broadcast.close();
    }
  }

  async complete(jobs: Job[]): Promise<void> {
    await this.ensureInitialized();
    const trx = this.database.transaction(['jobs'], 'readwrite');

    for (const { id } of jobs) {
      await trx
        .objectStore('jobs')
        .delete(typeof id === 'string' ? parseInt(id) : id);
    }
  }

  async return(jobs: Job[]): Promise<void> {
    await this.ensureInitialized();
    const trx = this.database.transaction(['jobs'], 'readwrite');

    for (const { id } of jobs) {
      const nid = typeof id === 'string' ? parseInt(id) : id;
      const job = await trx.objectStore('jobs').get(nid);
      if (job) {
        await trx.objectStore('jobs').put({ ...job, startTime: null }, nid);
      }
    }
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    const trx = this.database.transaction(['jobs'], 'readwrite');
    await trx.objectStore('jobs').clear();
  }

  async setPriority(batchKey: string, priority: number): Promise<void> {
    this.priorityMap.set(batchKey, priority);
  }

  async clearPriority(batchKey: string): Promise<void> {
    this.priorityMap.delete(batchKey);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.database) {
      await this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (this.database) {
      return;
    }
    this.database = await openDB(this.databaseName, 1, {
      upgrade(database) {
        const jobs = database.createObjectStore('jobs', {
          autoIncrement: true,
        });
        jobs.createIndex('batchKey', 'batchKey');
      },
    });
  }

  TIMEOUT = 1000 * 60 * 1 /* 1 minute */;

  private isTimeout(job: JobRecord) {
    return job.startTime !== null && job.startTime + this.TIMEOUT < Date.now();
  }

  private isAcceptable(job: JobRecord) {
    return job.startTime === null || this.isTimeout(job);
  }
}

function defer() {
  const deferred = {} as {
    promise: Promise<void>;
    resolve: () => void;
    reject: (reason?: any) => void;
  };
  const promise = new Promise<void>(function (resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  deferred.promise = promise;
  return deferred;
}
