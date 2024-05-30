import type { Document, Query, Schema } from '../../';
import {
  FullTextInvertedIndex,
  IntegerInvertedIndex,
  type InvertedIndex,
  StringInvertedIndex,
} from './inverted-index';
import { Match } from './match';

type DataRecord = {
  id: string;
  data: Map<string, string[]>;
  deleted: boolean;
};

export class DataStruct {
  records: DataRecord[] = [];

  idMap = new Map<string, number>();

  invertedIndex = new Map<string, InvertedIndex>();

  constructor(schema: Schema) {
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

  insert(document: Document) {
    if (this.idMap.has(document.id)) {
      throw new Error('Document already exists');
    }

    this.records.push({
      id: document.id,
      data: document.fields as Map<string, string[]>,
      deleted: false,
    });

    const nid = this.records.length - 1;
    this.idMap.set(document.id, nid);
    for (const [key, values] of document.fields) {
      for (const value of values) {
        const iidx = this.invertedIndex.get(key as string);
        if (!iidx) {
          throw new Error(
            `Inverted index '${key.toString()}' not found, document not match schema`
          );
        }
        iidx.insert(nid, value);
      }
    }
  }

  delete(id: string) {
    const nid = this.idMap.get(id);
    if (nid === undefined) {
      throw new Error('Document not found');
    }

    this.records[nid].deleted = true;
    this.records[nid].data = new Map();
  }

  matchAll(): Match {
    const weight = new Match();
    for (let i = 0; i < this.records.length; i++) {
      weight.addScore(i, 1);
    }
    return weight;
  }

  private queryRaw(query: Query<any>): Match {
    if (query.type === 'match') {
      const iidx = this.invertedIndex.get(query.field as string);
      if (!iidx) {
        throw new Error(`Field '${query.field as string}' not found`);
      }
      return iidx.match(query.match);
    } else if (query.type === 'boolean') {
      const weights = query.queries.map(q => this.queryRaw(q));
      if (query.occur === 'must') {
        return weights.reduce((acc, w) => acc.and(w));
      } else if (query.occur === 'must_not') {
        const total = weights.reduce((acc, w) => acc.and(w));
        return this.matchAll().exclude(total);
      } else if (query.occur === 'should') {
        return weights.reduce((acc, w) => acc.or(w));
      }
    } else if (query.type === 'all') {
      return this.matchAll();
    }
    throw new Error(`Query type '${query.type}' not supported`);
  }

  query(query: Query<any>): Match {
    return this.queryRaw(query).filter(id => !this.records[id].deleted);
  }

  has(id: string): boolean {
    return this.idMap.has(id);
  }
}
