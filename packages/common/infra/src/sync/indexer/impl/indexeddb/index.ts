import {
  type AggregateOptions,
  type AggregateResult,
  type Document,
  type Index,
  type IndexStorage,
  type IndexWriter,
  type Query,
  type Schema,
  type SearchOptions,
  type SearchResult,
} from '../../';
import { DataStruct } from './data-struct';

export class IndexedDBIndex<S extends Schema> implements Index<S> {
  data: DataStruct | null = null;

  constructor(private readonly databaseName: string = 'indexer') {}

  private ensureInitialized(
    data: DataStruct | null
  ): asserts data is DataStruct {
    if (!data) {
      throw new Error('IndexedDBIndex not initialized');
    }
  }

  async initialize(schema: Schema, cleanup: boolean = false): Promise<void> {
    if (this.data) {
      throw new Error('IndexedDBIndex already initialized');
    }
    const data = new DataStruct(this.databaseName, schema);
    await data.initialize(cleanup);
    this.data = data;
  }

  async write(): Promise<IndexWriter<S>> {
    this.ensureInitialized(this.data);
    return new IndexedDBIndexWriter(this.data);
  }

  async has(id: string): Promise<boolean> {
    this.ensureInitialized(this.data);
    return this.data.has(id);
  }

  async search(
    query: Query<any>,
    options: SearchOptions<any> = {}
  ): Promise<SearchResult<any, SearchOptions<any>>> {
    this.ensureInitialized(this.data);
    return this.data.search(query, options);
  }

  aggregate(
    query: Query<any>,
    field: string,
    options: AggregateOptions<any> = {}
  ): Promise<AggregateResult<any, AggregateOptions<any>>> {
    this.ensureInitialized(this.data);
    return this.data.aggregate(query, field, options);
  }
}

export class IndexedDBIndexWriter<S extends Schema> implements IndexWriter<S> {
  inserts: Document[] = [];
  deletes: string[] = [];

  constructor(private readonly data: DataStruct) {}

  insert(document: Document): void {
    this.inserts.push(document);
  }
  delete(id: string): void {
    this.deletes.push(id);
  }
  put(document: Document): void {
    this.delete(document.id);
    this.insert(document);
  }
  async commit(): Promise<void> {
    return this.data.batchWrite(this.deletes, this.inserts);
  }
  rollback(): void {}
  has(id: string): Promise<boolean> {
    return Promise.resolve(this.data.has(id));
  }
}

export class IndexedDBIndexStorage implements IndexStorage {
  constructor(private readonly databaseName: string) {}
  getIndex<S extends Schema>(name: string): Index<S> {
    return new IndexedDBIndex(this.databaseName + ':' + name);
  }
}
