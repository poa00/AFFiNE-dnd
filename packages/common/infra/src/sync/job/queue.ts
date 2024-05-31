export interface Job<Payload> {
  batchKey: string;
  payload: Payload;
}

export interface JobQueue<Payload> {
  initialize(cleanup: boolean): Promise<void>;

  enqueue(task: Job<Payload>): Promise<void>;

  accept(priorityBatchKeys: [string, number][]): Promise<Job<Payload>[] | null>;

  complete(task: Job<Payload>[]): Promise<void>;

  clear(): Promise<void>;
}
