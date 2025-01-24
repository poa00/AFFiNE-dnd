import {
  type Column,
  DatabaseBlockSchema,
  type SerializedCells,
} from '@blocksuite/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
  HastUtils,
  type InlineHtmlAST,
  TextUtils,
} from '@blocksuite/affine-shared/adapters';
import { nanoid } from '@blocksuite/store';
import type { Element } from 'hast';

import { processTable } from './utils';

const DATABASE_NODE_TYPES = new Set(['table', 'thead', 'tbody', 'th', 'tr']);

export const databaseBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: DatabaseBlockSchema.model.flavour,
  toMatch: o =>
    HastUtils.isElement(o.node) && DATABASE_NODE_TYPES.has(o.node.tagName),
  fromMatch: o => o.node.flavour === DatabaseBlockSchema.model.flavour,
  toBlockSnapshot: {
    enter: (o, context) => {
      if (!HastUtils.isElement(o.node)) {
        return;
      }
      const { walkerContext } = context;
      if (o.node.tagName === 'table') {
        const tableHeader = HastUtils.querySelector(o.node, 'thead');
        if (!tableHeader) {
          return;
        }
        const tableHeaderRow = HastUtils.querySelector(tableHeader, 'tr');
        if (!tableHeaderRow) {
          return;
        }
        // Table header row as database header row
        const viewsColumns = tableHeaderRow.children.map(() => {
          return {
            id: nanoid(),
            hide: false,
            width: 180,
          };
        });

        // Build database cells from table body rows
        const cells = Object.create(null);
        const tableBody = HastUtils.querySelector(o.node, 'tbody');
        tableBody?.children.forEach(row => {
          const rowId = nanoid();
          cells[rowId] = Object.create(null);
          (row as Element).children.forEach((cell, index) => {
            const column = viewsColumns[index];
            if (!column) {
              return;
            }
            cells[rowId][column.id] = {
              columnId: column.id,
              value: TextUtils.createText(
                (cell as Element).children
                  .map(child => ('value' in child ? child.value : ''))
                  .join('')
              ),
            };
          });
        });

        // Build database columns from table header row
        const columns = tableHeaderRow.children.flatMap((_child, index) => {
          const column = viewsColumns[index];
          if (!column) {
            return [];
          }
          return {
            type: index === 0 ? 'title' : 'rich-text',
            name: (_child as Element).children
              .map(child => ('value' in child ? child.value : ''))
              .join(''),
            data: {},
            id: column.id,
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
                    titleColumn: viewsColumns[0]?.id,
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
        walkerContext.setNodeContext('affine:table:rowid', Object.keys(cells));
        walkerContext.skipChildren(1);
      }

      // The first child of each table body row is the database title cell
      if (o.node.tagName === 'tr') {
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
      if (!HastUtils.isElement(o.node)) {
        return;
      }
      const { walkerContext } = context;
      if (o.node.tagName === 'table') {
        walkerContext.closeNode();
      }
    },
  },
  fromBlockSnapshot: {
    enter: (o, context) => {
      const { walkerContext } = context;
      const columns = o.node.props.columns as Array<Column>;
      const children = o.node.children;
      const cells = o.node.props.cells as SerializedCells;
      const table = processTable(columns, children, cells);
      const createAstTableCell = (
        children: InlineHtmlAST[]
      ): InlineHtmlAST => ({
        type: 'element',
        tagName: 'td',
        properties: Object.create(null),
        children,
      });

      const createAstTableHeaderCell = (
        children: InlineHtmlAST[]
      ): InlineHtmlAST => ({
        type: 'element',
        tagName: 'th',
        properties: Object.create(null),
        children,
      });

      const createAstTableRow = (cells: InlineHtmlAST[]): Element => ({
        type: 'element',
        tagName: 'tr',
        properties: Object.create(null),
        children: cells,
      });

      const { deltaConverter } = context;

      const tableHeaderAst: Element = {
        type: 'element',
        tagName: 'thead',
        properties: Object.create(null),
        children: [
          createAstTableRow(
            table.headers.map(v =>
              createAstTableHeaderCell([
                {
                  type: 'text',
                  value: v.name ?? '',
                },
              ])
            )
          ),
        ],
      };

      const tableBodyAst: Element = {
        type: 'element',
        tagName: 'tbody',
        properties: Object.create(null),
        children: table.rows.map(v => {
          return createAstTableRow(
            v.cells.map(cell => {
              return createAstTableCell(
                typeof cell.value === 'string'
                  ? [{ type: 'text', value: cell.value }]
                  : deltaConverter.deltaToAST(cell.value.delta)
              );
            })
          );
        }),
      };

      walkerContext
        .openNode({
          type: 'element',
          tagName: 'table',
          properties: Object.create(null),
          children: [tableHeaderAst, tableBodyAst],
        })
        .closeNode();

      walkerContext.skipAllChildren();
    },
  },
};

export const DatabaseBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  databaseBlockHtmlAdapterMatcher
);
