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
import type { Match } from './match';

export class MemoryIndex implements BackendIndex {
  private data: DataStruct | null = null;

  private ensureInitialized(
    data: DataStruct | null
  ): asserts data is DataStruct {
    if (!data) {
      throw new Error('MemoryBackend not initialized');
    }
  }

  initialize(schema: Schema): Promise<void> {
    this.data = new DataStruct(schema);
    return Promise.resolve();
  }

  write(): Promise<BackendWriter> {
    this.ensureInitialized(this.data);
    return Promise.resolve(new MemoryIndexWriter(this.data));
  }

  has(id: string): Promise<boolean> {
    this.ensureInitialized(this.data);
    return Promise.resolve(this.data.has(id));
  }

  search(
    query: Query<any>,
    options: SearchOptions<any>
  ): Promise<SearchResult<any, any>> {
    this.ensureInitialized(this.data);
    const data = this.data;

    const pagination = {
      skip: options.pagination?.skip ?? 0,
      limit: options.pagination?.limit ?? 100,
    };

    const match = data.query(query);

    const nids = match
      .toArray()
      .slice(pagination.skip, pagination.skip + pagination.limit);

    return Promise.resolve({
      pagination: {
        count: match.size(),
        hasMore: match.size() > pagination.limit + pagination.skip,
        limit: pagination.limit,
        skip: pagination.skip,
      },
      nodes: nids.map(nid => this.resultNode(match, nid, options)),
    });
  }

  aggregate(
    query: Query<any>,
    field: string,
    options: AggregateOptions<any>
  ): Promise<AggregateResult<any, any>> {
    this.ensureInitialized(this.data);
    const data = this.data;

    const pagination = {
      skip: options.pagination?.skip ?? 0,
      limit: options.pagination?.limit ?? 100,
    };

    const match = data.query(query);

    const nids = match.toArray();

    const buckets: { key: string; nids: number[] }[] = [];

    for (const nid of nids) {
      for (const value of this.data.records[nid].data.get(field) ?? []) {
        let bucket = buckets.find(b => b.key === value);
        if (!bucket) {
          bucket = { key: value, nids: [] };
          buckets.push(bucket);
        }
        bucket.nids.push(nid);
      }
    }

    return Promise.resolve({
      buckets: buckets
        .slice(pagination.skip, pagination.skip + pagination.limit)
        .map(bucket => {
          const result = {
            key: bucket.key,
            score: match.getScore(bucket.nids[0]),
            count: bucket.nids.length,
          } as AggregateResult<any, any>['buckets'][number];

          if (options.hits) {
            const hitsOptions = options.hits;
            const pagination = {
              skip: options.hits.pagination?.skip ?? 0,
              limit: options.hits.pagination?.limit ?? 3,
            };

            const hits = bucket.nids.slice(
              pagination.skip,
              pagination.skip + pagination.limit
            );

            (result as any).hits = {
              pagination: {
                count: bucket.nids.length,
                hasMore:
                  bucket.nids.length > pagination.limit + pagination.skip,
                limit: pagination.limit,
                skip: pagination.skip,
              },
              nodes: hits.map(nid => this.resultNode(match, nid, hitsOptions)),
            } as SearchResult<any, any>;
          }

          return result;
        }),
      pagination: {
        count: buckets.length,
        hasMore: buckets.length > pagination.limit + pagination.skip,
        limit: pagination.limit,
        skip: pagination.skip,
      },
    });
  }

  private resultNode(
    match: Match,
    nid: number,
    options: SearchOptions<any>
  ): SearchResult<any, any>['nodes'][number] {
    this.ensureInitialized(this.data);
    const data = this.data;

    const node = {
      id: data.records[nid].id,
      score: match.getScore(nid),
    } as any;

    if (options.fields) {
      const fields = {} as Record<string, string | string[]>;
      for (const field of options.fields as string[]) {
        fields[field] = data.records[nid].data.get(field) ?? [''];
        if (fields[field].length === 1) {
          fields[field] = fields[field][0];
        }
      }
      node.fields = fields;
    }

    if (options.highlights) {
      const highlights = {} as Record<string, string[]>;
      for (const { field, before, end } of options.highlights) {
        highlights[field] = match
          .getHighlighters(nid, field)
          .flatMap(highlighter => {
            return highlighter(before, end);
          });
      }
      node.highlights = highlights;
    }

    return node;
  }
}

export class MemoryIndexWriter implements BackendWriter {
  inserts: Document[] = [];
  deletes: string[] = [];

  constructor(private readonly data: DataStruct) {}

  insert(document: Document): void {
    this.inserts.push(document);
  }
  delete(id: string): void {
    this.deletes.push(id);
  }
  commit(): Promise<void> {
    for (const del of this.deletes) {
      this.data.delete(del);
    }
    for (const inst of this.inserts) {
      this.data.insert(inst);
    }
    return Promise.resolve();
  }
  rollback(): void {}
  has(id: string): Promise<boolean> {
    return Promise.resolve(this.data.has(id));
  }
}
