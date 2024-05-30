// import type { BackendIndex } from './backend';
// import { type Crawler, CrawlerScheduler } from './crawler';
// import type { Discoverer } from './discoverer';
// import { Indexer } from './indexer';
// import type { Schema } from './schema';
// import { MANUALLY_STOP, throwIfAborted } from './throw-if-aborted';

// export class SearchEngine<DiscovererInfo = undefined> {
//   scheduler = new CrawlerScheduler(this.crawler);
//   indexer = new Indexer(this.schema, this.backend);

//   constructor(
//     private readonly discoverer: Discoverer<DiscovererInfo>,
//     private readonly crawler: Crawler<DiscovererInfo>,
//     private readonly schema: Schema,
//     private readonly backend: BackendIndex
//   ) {}

//   initialize() {
//     return this.indexer.initialize();
//   }

//   abort = new AbortController();

//   start() {
//     this.abort.abort(MANUALLY_STOP);
//     this.abort = new AbortController();

//     this.mainLoop(this.abort.signal).catch(err => {
//       if (err === MANUALLY_STOP) {
//         return;
//       }
//       console.error('Search engine error', err);
//     });
//   }

//   private async mainLoop(signal: AbortSignal) {
//     const subscription = this.discoverer.subscribe(updateIds => {
//       for (const update of updateIds) {
//         this.scheduler.requestRevaluate(update.id, update.info);
//       }
//     });

//     try {
//       while (throwIfAborted(signal)) {
//         await this.scheduler.crawl(signal);
//       }
//     } finally {
//       subscription.dispose();
//     }
//   }

//   stop() {
//     this.abort.abort(MANUALLY_STOP);
//   }

//   async requestFullyRevaluate() {
//     const ids = new Map<string, DiscovererInfo | undefined>();

//     {
//       const [allIds] = await this.indexer.search({ type: 'all' }, [
//         { type: 'TopDocs', limit: Infinity, skip: 0 },
//       ]);
//       for (const id of allIds) {
//         ids.set(id, undefined);
//       }
//     }

//     {
//       const allIds = await this.discoverer.discover(this.abort.signal);
//       for (const { id, info } of allIds) {
//         ids.set(id, info);
//       }
//     }

//     for (const [id, info] of ids) {
//       this.scheduler.requestRevaluate(id, info);
//     }
//   }
// }
