import type { Document } from './document';
import type { Schema } from './schema';
import type { Searcher } from './searcher';

export interface BackendIndex extends BackendReader, BackendSearcher {
  initialize(schema: Schema, cleanup: boolean): Promise<void>;

  write(): Promise<BackendWriter>;
}

export interface BackendWriter extends BackendReader {
  insert(document: Document): void;

  delete(id: string): void;

  commit(): Promise<void>;

  rollback(): void;
}

export interface BackendReader {
  has(id: string): Promise<boolean>;
}

export interface BackendSearcher extends Searcher {}
