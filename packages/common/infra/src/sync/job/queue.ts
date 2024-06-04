export interface JobParams<Payload = any> {
  batchKey: string;
  payload: Payload;
}

export interface Job<Payload = any> extends JobParams<Payload> {
  id: string;
}

export interface JobQueue<Payload> {
  initialize(cleanup: boolean): Promise<void>;

  enqueue(jobs: JobParams<Payload>[]): Promise<void>;

  accept(): Promise<Job<Payload>[] | null>;

  waitForAccept(signal: AbortSignal): Promise<Job<Payload>[]>;

  return(jobs: Job<Payload>[]): Promise<void>;

  complete(jobs: Job<Payload>[]): Promise<void>;

  setPriority(batchKey: string, priority: number): void;

  clearPriority(batchKey: string): void;

  clear(): Promise<void>;
}
