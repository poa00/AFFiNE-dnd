import type { BackendWriter } from './backend';
import type { Document } from './document';
import type { Schema } from './schema';

export class IndexWriter<S extends Schema> {
  constructor(private readonly backend: BackendWriter) {}

  insert(document: Document<S>) {
    this.backend.insert(document);
  }

  delete(id: string) {
    this.backend.delete(id);
  }

  async commit() {
    await this.backend.commit();
  }

  rollback() {
    this.backend.rollback();
  }
}
