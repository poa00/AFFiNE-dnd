import {
  type Column,
  DatabaseBlockSchema,
  type SerializedCells,
} from '@blocksuite/affine-model';
import {
  BlockMarkdownAdapterExtension,
  type BlockMarkdownAdapterMatcher,
  type MarkdownAST,
  TextUtils,
} from '@blocksuite/affine-shared/adapters';
import { nanoid } from '@blocksuite/store';
import type { TableRow } from 'mdast';

import { processTable } from './utils';

const DATABASE_NODE_TYPES = new Set(['table', 'tableRow']);

const isDatabaseNode = (node: MarkdownAST) =>
  DATABASE_NODE_TYPES.has(node.type);

export const databaseBlockMarkdownAdapterMatcher: BlockMarkdownAdapterMatcher =
  {
    flavour: DatabaseBlockSchema.model.flavour,
    toMatch: o => isDatabaseNode(o.node),
    fromMatch: o => o.node.flavour === DatabaseBlockSchema.model.flavour,
    toBlockSnapshot: {
      enter: (o, context) => {
        const { walkerContext } = context;
        if (o.node.type === 'table') {
          const viewsColumns = o.node.children[0]?.children.map(() => {
            return {
              id: nanoid(),
              hide: false,
              width: 180,
            };
          });
          const cells = Object.create(null);
          o.node.children.slice(1).forEach(row => {
            const rowId = nanoid();
            cells[rowId] = Object.create(null);
            row.children.slice(1).forEach((cell, index) => {
              const column = viewsColumns?.[index + 1];
              if (!column) {
                return;
              }
              cells[rowId][column.id] = {
                columnId: column.id,
                value: TextUtils.createText(
                  cell.children
                    .map(child => ('value' in child ? child.value : ''))
                    .join('')
                ),
              };
            });
          });
          const columns = o.node.children[0]?.children.map((_child, index) => {
            return {
              type: index === 0 ? 'title' : 'rich-text',
              name: _child.children
                .map(child => ('value' in child ? child.value : ''))
                .join(''),
              data: {},
              id: viewsColumns?.[index]?.id,
            };
          });
          walkerContext.openNode(
            {
              type: 'block',
              id: nanoid(),
              flavour: 'affine:database',
              props: {
                views: [
                  {
                    id: nanoid(),
                    name: 'Table View',
                    mode: 'table',
                    columns: [],
                    filter: {
                      type: 'group',
                      op: 'and',
                      conditions: [],
                    },
                    header: {
                      titleColumn: viewsColumns?.[0]?.id,
                      iconColumn: 'type',
                    },
                  },
                ],
                title: {
                  '$blocksuite:internal:text$': true,
                  delta: [],
                },
                cells,
                columns,
              },
              children: [],
            },
            'children'
          );
          walkerContext.setNodeContext(
            'affine:table:rowid',
            Object.keys(cells)
          );
          walkerContext.skipChildren(1);
        }

        if (o.node.type === 'tableRow') {
          const { deltaConverter } = context;
          const firstChild = o.node.children[0];
          if (!firstChild) {
            return;
          }
          walkerContext
            .openNode({
              type: 'block',
              id:
                (
                  walkerContext.getNodeContext(
                    'affine:table:rowid'
                  ) as Array<string>
                ).shift() ?? nanoid(),
              flavour: 'affine:paragraph',
              props: {
                text: {
                  '$blocksuite:internal:text$': true,
                  delta: deltaConverter.astToDelta(firstChild),
                },
                type: 'text',
              },
              children: [],
            })
            .closeNode();
          walkerContext.skipAllChildren();
        }
      },
      leave: (o, context) => {
        const { walkerContext } = context;
        if (o.node.type === 'table') {
          walkerContext.closeNode();
        }
      },
    },
    fromBlockSnapshot: {
      enter: (o, context) => {
        const { walkerContext, deltaConverter } = context;
        const rows: TableRow[] = [];
        const columns = o.node.props.columns as Array<Column>;
        const children = o.node.children;
        const cells = o.node.props.cells as SerializedCells;
        const table = processTable(columns, children, cells);
        rows.push({
          type: 'tableRow',
          children: table.headers.map(v => ({
            type: 'tableCell',
            children: [{ type: 'text', value: v.name }],
          })),
        });
        table.rows.forEach(v => {
          rows.push({
            type: 'tableRow',
            children: v.cells.map(v => ({
              type: 'tableCell',
              children:
                typeof v.value === 'string'
                  ? [{ type: 'text', value: v.value }]
                  : deltaConverter.deltaToAST(v.value.delta),
            })),
          });
        });

        walkerContext
          .openNode({
            type: 'table',
            children: rows,
          })
          .closeNode();

        walkerContext.skipAllChildren();
      },
    },
  };

export const DatabaseBlockMarkdownAdapterExtension =
  BlockMarkdownAdapterExtension(databaseBlockMarkdownAdapterMatcher);
