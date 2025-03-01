import { matchFlavours } from '@blocksuite/affine-shared/utils';
import type { Command } from '@blocksuite/block-std';

export const dedentBlockToRoot: Command<
  never,
  never,
  {
    blockId?: string;
    stopCapture?: boolean;
  }
> = (ctx, next) => {
  let { blockId } = ctx;
  const { std, stopCapture = true } = ctx;
  const { store } = std;
  if (!blockId) {
    const sel = std.selection.getGroup('note').at(0);
    blockId = sel?.blockId;
  }
  if (!blockId) return;
  const model = std.store.getBlock(blockId)?.model;
  if (!model) return;

  let parent = store.getParent(model);
  let changed = false;
  while (parent && !matchFlavours(parent, ['affine:note'])) {
    if (!changed) {
      if (stopCapture) store.captureSync();
      changed = true;
    }
    std.command.exec('dedentBlock', { blockId: model.id, stopCapture: true });
    parent = store.getParent(model);
  }

  if (!changed) {
    return;
  }

  return next();
};
