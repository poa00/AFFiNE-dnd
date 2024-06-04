import type { Document } from './document';
import type { Schema } from './schema';
import type { Searcher } from './searcher';

export interface Index<S extends Schema> extends IndexReader, Searcher<S> {
  initialize(schema: S, cleanup?: boolean): Promise<void>;

  write(): Promise<IndexWriter<S>>;
}

export interface IndexWriter<S extends Schema> extends IndexReader {
  insert(document: Document<S>): void;

  put(document: Document<S>): void;

  delete(id: string): void;

  commit(): Promise<void>;

  rollback(): void;
}

export interface IndexReader {
  has(id: string): Promise<boolean>;
}

export interface IndexStorage {
  getIndex<S extends Schema>(name: string): Index<S>;
}
