export { DocSearchService } from './services/doc-search';

import {
  type Framework,
  WorkspaceScope,
  WorkspaceService,
} from '@toeverything/infra';

import { DocIndexer } from './entities/doc-indexer';
import { DocSearchService } from './services/doc-search';

export function configureDocSearchModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(DocSearchService)
    .entity(DocIndexer, [WorkspaceService]);
}
