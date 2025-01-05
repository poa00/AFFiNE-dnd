import { Slot } from '@blocksuite/global/utils';
import type * as Y from 'yjs';

import { COLLECTION_VERSION, PAGE_VERSION } from '../consts.js';
import { createYProxy } from '../reactive/proxy.js';
import type {
  DocMeta,
  DocsPropertiesMeta,
  Workspace,
  WorkspaceMeta,
} from './workspace.js';

export type DocCollectionMetaState = {
  pages?: unknown[];
  properties?: DocsPropertiesMeta;
  workspaceVersion?: number;
  pageVersion?: number;
  blockVersions?: Record<string, number>;
  name?: string;
  avatar?: string;
};

export class DocCollectionMeta implements WorkspaceMeta {
  private readonly _handleDocCollectionMetaEvents = (
    events: Y.YEvent<Y.Array<unknown> | Y.Text | Y.Map<unknown>>[]
  ) => {
    events.forEach(e => {
      const hasKey = (k: string) =>
        e.target === this._yMap && e.changes.keys.has(k);

      if (
        e.target === this.yDocs ||
        e.target.parent === this.yDocs ||
        hasKey('pages')
      ) {
        this._handleDocMetaEvent();
      }

      if (hasKey('name') || hasKey('avatar')) {
        this._handleCommonFieldsEvent();
      }
    });
  };

  private _prevDocs = new Set<string>();

  protected readonly _proxy: DocCollectionMetaState;

  protected readonly _yMap: Y.Map<
    DocCollectionMetaState[keyof DocCollectionMetaState]
  >;

  commonFieldsUpdated = new Slot();

  readonly doc: Y.Doc;

  docMetaAdded = new Slot<string>();

  docMetaRemoved = new Slot<string>();

  docMetaUpdated = new Slot();

  readonly id: string = 'meta';

  get avatar() {
    return this._proxy.avatar;
  }

  get blockVersions() {
    return this._proxy.blockVersions;
  }

  get docMetas() {
    if (!this._proxy.pages) {
      return [] as DocMeta[];
    }
    return this._proxy.pages as DocMeta[];
  }

  get docs() {
    return this._proxy.pages;
  }

  get hasVersion() {
    if (!this.blockVersions || !this.pageVersion || !this.workspaceVersion) {
      return false;
    }
    return Object.keys(this.blockVersions).length > 0;
  }

  get name() {
    return this._proxy.name;
  }

  get pageVersion() {
    return this._proxy.pageVersion;
  }

  get properties(): DocsPropertiesMeta {
    const meta = this._proxy.properties;
    if (!meta) {
      return {
        tags: {
          options: [],
        },
      };
    }
    return meta;
  }

  get workspaceVersion() {
    return this._proxy.workspaceVersion;
  }

  get yDocs() {
    return this._yMap.get('pages') as unknown as Y.Array<unknown>;
  }

  constructor(doc: Y.Doc) {
    this.doc = doc;
    const map = doc.getMap(this.id) as Y.Map<
      DocCollectionMetaState[keyof DocCollectionMetaState]
    >;
    this._yMap = map;
    this._proxy = createYProxy(map);
    this._yMap.observeDeep(this._handleDocCollectionMetaEvents);
  }

  private _handleCommonFieldsEvent() {
    this.commonFieldsUpdated.emit();
  }

  private _handleDocMetaEvent() {
    const { docMetas, _prevDocs } = this;

    const newDocs = new Set<string>();

    docMetas.forEach(docMeta => {
      if (!_prevDocs.has(docMeta.id)) {
        this.docMetaAdded.emit(docMeta.id);
      }
      newDocs.add(docMeta.id);
    });

    _prevDocs.forEach(prevDocId => {
      const isRemoved = newDocs.has(prevDocId) === false;
      if (isRemoved) {
        this.docMetaRemoved.emit(prevDocId);
      }
    });

    this._prevDocs = newDocs;

    this.docMetaUpdated.emit();
  }

  addDocMeta(doc: DocMeta, index?: number) {
    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      const docs = this.docs as unknown[];
      if (index === undefined) {
        docs.push(doc);
      } else {
        docs.splice(index, 0, doc);
      }
    }, this.doc.clientID);
  }

  getDocMeta(id: string) {
    return this.docMetas.find(doc => doc.id === id);
  }

  initialize() {
    if (!this._proxy.pages) {
      this._proxy.pages = [];
    }
  }

  removeDocMeta(id: string) {
    // you cannot delete a doc if there's no doc
    if (!this.docs) {
      return;
    }

    const docMeta = this.docMetas;
    const index = docMeta.findIndex((doc: DocMeta) => id === doc.id);
    if (index === -1) {
      return;
    }
    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      this.docs.splice(index, 1);
    }, this.doc.clientID);
  }

  setAvatar(avatar: string) {
    this.doc.transact(() => {
      this._proxy.avatar = avatar;
    }, this.doc.clientID);
  }

  setDocMeta(id: string, props: Partial<DocMeta>) {
    const docs = (this.docs as DocMeta[]) ?? [];
    const index = docs.findIndex((doc: DocMeta) => id === doc.id);

    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      if (index === -1) return;

      const doc = this.docs[index] as Record<string, unknown>;
      Object.entries(props).forEach(([key, value]) => {
        doc[key] = value;
      });
    }, this.doc.clientID);
  }

  setName(name: string) {
    this.doc.transact(() => {
      this._proxy.name = name;
    }, this.doc.clientID);
  }

  setProperties(meta: DocsPropertiesMeta) {
    this._proxy.properties = meta;
    this.docMetaUpdated.emit();
  }

  /**
   * @internal Only for doc initialization
   */
  writeVersion(collection: Workspace) {
    const { blockVersions, pageVersion, workspaceVersion } = this._proxy;

    if (!workspaceVersion) {
      this._proxy.workspaceVersion = COLLECTION_VERSION;
    } else {
      console.error('Workspace version is already set');
    }

    if (!pageVersion) {
      this._proxy.pageVersion = PAGE_VERSION;
    } else {
      console.error('Doc version is already set');
    }

    if (!blockVersions) {
      const _versions: Record<string, number> = {};
      collection.schema.flavourSchemaMap.forEach((schema, flavour) => {
        _versions[flavour] = schema.version;
      });
      this._proxy.blockVersions = _versions;
    } else {
      console.error('Block versions is already set');
    }
  }
}
