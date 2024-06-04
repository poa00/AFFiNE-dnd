import type { Schema } from './schema';

export class Document<S extends Schema = any> {
  constructor(public readonly id: string) {}

  fields = new Map<keyof S, string[]>();

  public insert<F extends keyof S>(field: F, value: string | string[]) {
    const values = this.fields.get(field) ?? [];
    if (Array.isArray(value)) {
      values.push(...value);
    } else {
      values.push(value);
    }
    this.fields.set(field, values);
  }

  static from<S extends Schema>(
    id: string,
    map: Record<keyof S, string | string[]>
  ): Document<S> {
    const doc = new Document(id);
    for (const key in map) {
      doc.insert(key, map[key] as string | string[]);
    }
    return doc;
  }
}
