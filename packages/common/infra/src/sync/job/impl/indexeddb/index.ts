import type { DBSchema } from 'idb';

import type { Job, JobQueue } from '../../';

export interface IndexDB extends DBSchema {
  jobs: {
    key: string;
    value: {
      batchKey: string;
      startTime: number | null;
      payload: any;
    };
  };
}

export class IndexedDBJobQueue<J extends Job<any>> implements JobQueue<J> {
  initialize(cleanup: boolean): Promise<void> {}
  enqueue(task: Job<J>): Promise<void> {
    throw new Error('Method not implemented.');
  }
  accept(priorityBatchKeys: [string, number][]): Promise<Job<J>[] | null> {
    throw new Error('Method not implemented.');
  }
  complete(task: Job<J>[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  clear(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
