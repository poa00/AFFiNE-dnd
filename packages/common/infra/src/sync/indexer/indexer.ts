import type { BackendIndex } from './backend';
import { IndexWriter } from './index-writer';
import type { Query } from './query';
import type { Schema } from './schema';
import type {
  AggregateOptions,
  AggregateResult,
  Searcher,
  SearchOptions,
  SearchResult,
} from './searcher';

export class Index<S extends Schema> implements Searcher<S> {
  constructor(
    private readonly schema: S,
    private readonly backend: BackendIndex
  ) {}

  async initialize(cleanup: boolean): Promise<void> {
    return this.backend.initialize(this.schema, cleanup);
  }

  search<const O extends SearchOptions<S>>(
    query: Query<S>,
    options: O = {} as O
  ): Promise<SearchResult<S, O>> {
    return this.backend.search(query, options);
  }

  aggregate<const O extends AggregateOptions<S>>(
    query: Query<S>,
    field: keyof S,
    options: O = {} as O
  ): Promise<AggregateResult<S, O>> {
    return this.backend.aggregate(query, field, options);
  }

  async write(): Promise<IndexWriter<S>> {
    return new IndexWriter(await this.backend.write());
  }
}
