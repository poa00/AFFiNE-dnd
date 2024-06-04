import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames,
} from 'idb';

import type {
  AggregateOptions,
  AggregateResult,
  Document,
  Query,
  Schema,
  SearchOptions,
  SearchResult,
} from '../../';
import {
  FullTextInvertedIndex,
  IntegerInvertedIndex,
  type InvertedIndex,
  StringInvertedIndex,
} from './inverted-index';
import { Match } from './match';

export interface IndexDB extends DBSchema {
  kvMetadata: {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
  records: {
    key: number;
    value: {
      id: string;
      data: Map<string, string[]>;
    };
    indexes: { id: string };
  };
  invertedIndex: {
    key: number;
    value: {
      nid: number;
      pos?: {
        i: number /* index */;
        l: number /* length */;
        rs: [number, number][] /* ranges: [start, end] */;
      };
      key: ArrayBuffer;
    };
    indexes: { key: ArrayBuffer };
  };
}

export class DataStruct {
  database: IDBPDatabase<IndexDB> | null = null;
  invertedIndex = new Map<string, InvertedIndex>();

  constructor(
    private readonly databaseName: string,
    schema: Schema
  ) {
    for (const [key, type] of Object.entries(schema)) {
      if (type === 'String') {
        this.invertedIndex.set(key, new StringInvertedIndex(key));
      } else if (type === 'Integer') {
        this.invertedIndex.set(key, new IntegerInvertedIndex(key));
      } else if (type === 'FullText') {
        this.invertedIndex.set(key, new FullTextInvertedIndex(key));
      } else if (type === 'Date') {
        this.invertedIndex.set(key, new IntegerInvertedIndex(key));
      } else {
        throw new Error(`Field type '${type}' not supported`);
      }
    }
  }

  async initialize(cleanup: boolean) {
    this.database = await openDB<IndexDB>(this.databaseName, 1, {
      upgrade(database) {
        database.createObjectStore('kvMetadata', {
          keyPath: 'key',
        });
        const recordsStore = database.createObjectStore('records', {
          autoIncrement: true,
        });
        recordsStore.createIndex('id', 'id', {
          unique: true,
        });
        const invertedIndexStore = database.createObjectStore('invertedIndex', {
          autoIncrement: true,
        });
        invertedIndexStore.createIndex('key', 'key', { unique: false });
      },
    });
    if (cleanup) {
      const trx = this.database.transaction(
        ['records', 'invertedIndex', 'kvMetadata'],
        'readwrite'
      );
      await trx.objectStore('records').clear();
      await trx.objectStore('invertedIndex').clear();
      await trx.objectStore('kvMetadata').clear();
    }
  }

  async insert(
    trx: IDBPTransaction<IndexDB, ArrayLike<StoreNames<IndexDB>>, 'readwrite'>,
    document: Document
  ) {
    this.ensureInitialized(this.database);

    const exists = await trx
      .objectStore('records')
      .index('id')
      .get(document.id);

    if (exists) {
      throw new Error('Document already exists');
    }

    const nid = await trx.objectStore('records').add({
      id: document.id,
      data: new Map(document.fields as Map<string, string[]>),
    });

    for (const [key, values] of document.fields) {
      const iidx = this.invertedIndex.get(key as string);
      if (!iidx) {
        throw new Error(
          `Inverted index '${key.toString()}' not found, document not match schema`
        );
      }
      await iidx.insert(trx, nid, values);
    }
  }

  async delete(
    trx: IDBPTransaction<IndexDB, ArrayLike<StoreNames<IndexDB>>, 'readwrite'>,
    id: string
  ) {
    this.ensureInitialized(this.database);

    const nid = await trx.objectStore('records').index('id').getKey(id);

    if (nid) {
      await trx.objectStore('records').delete(nid);
    }
  }

  async batchWrite(deletes: string[], inserts: Document[]) {
    this.ensureInitialized(this.database);
    const trx = this.database.transaction(
      ['records', 'invertedIndex', 'kvMetadata'],
      'readwrite'
    );

    for (const del of deletes) {
      await this.delete(trx, del);
    }
    for (const inst of inserts) {
      await this.insert(trx, inst);
    }
  }

  async matchAll(trx: IDBPTransaction<IndexDB>): Promise<Match> {
    this.ensureInitialized(this.database);

    const allNids = await trx.objectStore('records').getAllKeys();
    const match = new Match();

    for (const nid of allNids) {
      match.addScore(nid, 1);
    }
    return match;
  }

  private async queryRaw(
    trx: IDBPTransaction<IndexDB>,
    query: Query<any>
  ): Promise<Match> {
    if (query.type === 'match') {
      const iidx = this.invertedIndex.get(query.field as string);
      if (!iidx) {
        throw new Error(`Field '${query.field as string}' not found`);
      }
      return await iidx.match(trx, query.match);
    } else if (query.type === 'boolean') {
      const weights = [];
      for (const q of query.queries) {
        weights.push(await this.queryRaw(trx, q));
      }
      if (query.occur === 'must') {
        return weights.reduce((acc, w) => acc.and(w));
      } else if (query.occur === 'must_not') {
        const total = weights.reduce((acc, w) => acc.and(w));
        return (await this.matchAll(trx)).exclude(total);
      } else if (query.occur === 'should') {
        return weights.reduce((acc, w) => acc.or(w));
      }
    } else if (query.type === 'all') {
      return await this.matchAll(trx);
    }
    throw new Error(`Query type '${query.type}' not supported`);
  }

  private async query(
    trx: IDBPTransaction<IndexDB>,
    query: Query<any>
  ): Promise<Match> {
    this.ensureInitialized(this.database);
    const match = await this.queryRaw(trx, query);
    const filteredMatch = match.asyncFilter(async nid => {
      const record = await trx.objectStore('records').getKey(nid);
      return record !== undefined;
    });
    return filteredMatch;
  }

  async search(
    query: Query<any>,
    options: SearchOptions<any>
  ): Promise<SearchResult<any, any>> {
    this.ensureInitialized(this.database);
    const trx = this.database.transaction(
      ['records', 'invertedIndex', 'kvMetadata'],
      'readonly'
    );

    const pagination = {
      skip: options.pagination?.skip ?? 0,
      limit: options.pagination?.limit ?? 100,
    };

    const match = await this.query(trx, query);

    const nids = match
      .toArray()
      .slice(pagination.skip, pagination.skip + pagination.limit);

    const nodes = [];
    for (const nid of nids) {
      nodes.push(await this.resultNode(trx, match, nid, options));
    }

    return {
      pagination: {
        count: match.size(),
        hasMore: match.size() > pagination.limit + pagination.skip,
        limit: pagination.limit,
        skip: pagination.skip,
      },
      nodes: nodes,
    };
  }

  async aggregate(
    query: Query<any>,
    field: string,
    options: AggregateOptions<any>
  ): Promise<AggregateResult<any, any>> {
    this.ensureInitialized(this.database);

    const pagination = {
      skip: options.pagination?.skip ?? 0,
      limit: options.pagination?.limit ?? 100,
    };

    const hitPagination = options.hits
      ? {
          skip: options.hits.pagination?.skip ?? 0,
          limit: options.hits.pagination?.limit ?? 3,
        }
      : {
          skip: 0,
          limit: 0,
        };

    const trx = this.database.transaction(
      ['records', 'invertedIndex', 'kvMetadata'],
      'readonly'
    );

    const match = await this.query(trx, query);

    const nids = match.toArray();

    const buckets: {
      key: string;
      nids: number[];
      hits: SearchResult<any, any>['nodes'];
    }[] = [];

    for (const nid of nids) {
      const values = (await trx.objectStore('records').get(nid))?.data.get(
        field
      );
      for (const value of values ?? []) {
        let bucket;
        let bucketIndex = buckets.findIndex(b => b.key === value);
        if (bucketIndex === -1) {
          bucket = { key: value, nids: [], hits: [] };
          buckets.push(bucket);
          bucketIndex = buckets.length - 1;
        } else {
          bucket = buckets[bucketIndex];
        }

        if (
          bucketIndex >= pagination.skip &&
          bucketIndex < pagination.skip + pagination.limit
        ) {
          bucket.nids.push(nid);
          if (
            bucket.nids.length - 1 >= hitPagination.skip &&
            bucket.nids.length - 1 < hitPagination.skip + hitPagination.limit
          ) {
            bucket.hits.push(
              await this.resultNode(trx, match, nid, options.hits ?? {})
            );
          }
        }
      }
    }

    return {
      buckets: buckets
        .slice(pagination.skip, pagination.skip + pagination.limit)
        .map(bucket => {
          const result = {
            key: bucket.key,
            score: match.getScore(bucket.nids[0]),
            count: bucket.nids.length,
          } as AggregateResult<any, any>['buckets'][number];

          if (options.hits) {
            (result as any).hits = {
              pagination: {
                count: bucket.nids.length,
                hasMore:
                  bucket.nids.length > hitPagination.limit + hitPagination.skip,
                limit: hitPagination.limit,
                skip: hitPagination.skip,
              },
              nodes: bucket.hits,
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
    };
  }

  async has(id: string): Promise<boolean> {
    this.ensureInitialized(this.database);
    const trx = this.database.transaction(['records'], 'readonly');
    const nid = trx.objectStore('records').index('id').getKey(id);
    return nid !== undefined;
  }

  private ensureInitialized(
    data: IDBPDatabase<IndexDB> | null
  ): asserts data is IDBPDatabase<IndexDB> {
    if (!data) {
      throw new Error('DataStruct not initialized');
    }
  }

  private async resultNode(
    trx: IDBPTransaction<IndexDB>,
    match: Match,
    nid: number,
    options: SearchOptions<any>
  ): Promise<SearchResult<any, any>['nodes'][number]> {
    const record = await trx.objectStore('records').get(nid);
    if (!record) {
      throw new Error(`Record not found for nid ${nid}`);
    }

    const node = {
      id: record.id,
      score: match.getScore(nid),
    } as any;

    if (options.fields) {
      const fields = {} as Record<string, string | string[]>;
      for (const field of options.fields as string[]) {
        fields[field] = record.data.get(field) ?? [''];
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
            return highlighter(record.data.get(field) ?? [''], before, end);
          });
      }
      node.highlights = highlights;
    }

    return node;
  }
}
