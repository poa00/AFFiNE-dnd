import type {
  AggregateOptions,
  AggregateResult,
  BackendIndex,
  BackendWriter,
  Document,
  Query,
  Schema,
  SearchOptions,
  SearchResult,
} from '../../';
import { DataStruct } from './data-struct';

export class IndexedDBIndex implements BackendIndex {
  private data: DataStruct | null = null;

  constructor(private readonly databaseName: string = 'indexer') {}

  private ensureInitialized(
    data: DataStruct | null
  ): asserts data is DataStruct {
    if (!data) {
      throw new Error('MemoryBackend not initialized');
    }
  }

  async initialize(schema: Schema, cleanup: boolean): Promise<void> {
    this.data = new DataStruct(this.databaseName, schema);
    await this.data.initialize(cleanup);
  }
  async write(): Promise<BackendWriter> {
    this.ensureInitialized(this.data);
    return new IndexedDBIndexWriter(this.data);
  }
  async has(id: string): Promise<boolean> {
    this.ensureInitialized(this.data);
    return this.data.has(id);
  }
  async search<const O extends SearchOptions<any>>(
    query: Query<any>,
    options: O
  ): Promise<SearchResult<any, O>> {
    this.ensureInitialized(this.data);
    return this.data.search(query, options);
  }
  aggregate<const O extends AggregateOptions<any>>(
    query: Query<any>,
    field: string,
    options: O
  ): Promise<AggregateResult<any, O>> {
    this.ensureInitialized(this.data);
    return this.data.aggregate(query, field, options);
  }
}

export class IndexedDBIndexWriter implements BackendWriter {
  inserts: Document[] = [];
  deletes: string[] = [];

  constructor(private readonly data: DataStruct) {}

  insert(document: Document): void {
    this.inserts.push(document);
  }
  delete(id: string): void {
    this.deletes.push(id);
  }
  async commit(): Promise<void> {
    for (const del of this.deletes) {
      await this.data.delete(del);
    }
    for (const inst of this.inserts) {
      await this.data.insert(inst);
    }
    return;
  }
  rollback(): void {}
  has(id: string): Promise<boolean> {
    return Promise.resolve(this.data.has(id));
  }
}
