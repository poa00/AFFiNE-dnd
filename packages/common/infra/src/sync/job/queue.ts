interface Job<Payload> {
  batchKey: string;
  payload: Payload;
}

export interface JobQueue<Payload> {
  enqueue(task: Job<Payload>): Promise<void>;

  accept(): Promise<Job<Payload>[] | null>;

  complete(task: Job<Payload>[]): Promise<void>;

  setPriority(batchKey: string, priority: number): Promise<void>;

  clear(): Promise<void>;
}
