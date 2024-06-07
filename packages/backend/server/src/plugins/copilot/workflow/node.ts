import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger } from '@nestjs/common';
import Piscina from 'piscina';

import { CopilotChatOptions } from '../types';
import { getWorkflowExecutor, WorkflowExecutor } from './executor';
import {
  NodeData,
  WorkflowNodeState,
  WorkflowNodeType,
  WorkflowResult,
  WorkflowResultType,
} from './types';

export class WorkflowNode {
  private readonly logger = new Logger(WorkflowNode.name);
  private readonly edges: WorkflowNode[] = [];
  private readonly parents: WorkflowNode[] = [];
  private readonly executor: WorkflowExecutor | null = null;
  private readonly worker: Piscina;

  constructor(private readonly data: NodeData) {
    if (data.nodeType === WorkflowNodeType.Basic) {
      this.executor = getWorkflowExecutor(data.type);
    }
    this.worker = new Piscina({
      filename: path.resolve(
        dirname(fileURLToPath(import.meta.url)),
        'worker.mjs'
      ),
      minThreads: 2,
      // empty envs from parent process
      env: {},
      argv: [],
      execArgv: [],
    });
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get config(): NodeData {
    return Object.assign({}, this.data);
  }

  get parent(): WorkflowNode[] {
    return this.parents;
  }

  // if is the end of the workflow, pass through the content to stream response
  get hasEdges(): boolean {
    return !!this.edges.length;
  }

  private set parent(node: WorkflowNode) {
    if (!this.parents.includes(node)) {
      this.parents.push(node);
    }
  }

  addEdge(node: WorkflowNode): number {
    if (this.data.nodeType === WorkflowNodeType.Basic) {
      if (this.edges.length > 0) {
        throw new Error(`Basic block can only have one edge`);
      }
    } else if (
      this.data.nodeType === WorkflowNodeType.Decision &&
      !this.data.condition
    ) {
      throw new Error(`Decision block must have a condition`);
    }
    node.parent = this;
    this.edges.push(node);
    return this.edges.length;
  }

  private async evaluateCondition(
    condition: string,
    params: WorkflowNodeState
  ): Promise<string | undefined> {
    try {
      const chooseNode = this.worker.run({
        iife: `(${condition})(nodeIds, params)`,
        nodeIds: this.edges.map(node => node.id),
        params,
      });
      if (typeof chooseNode === 'string' && chooseNode) {
        return chooseNode;
      } else {
        this.logger.warn(
          `Failed to evaluate condition ${condition} for node ${this.name}: unknown chooseNode ${chooseNode}`
        );
      }
    } catch (e) {
      this.logger.error(
        `Failed to evaluate condition ${condition} for node ${this.name}: ${e}`
      );
      throw e;
    }
    return this.edges[0]?.id;
  }

  async *next(
    params: WorkflowNodeState,
    options?: CopilotChatOptions
  ): AsyncIterable<WorkflowResult> {
    yield { type: WorkflowResultType.StartRun, nodeId: this.id };

    // choose next node in graph
    let nextNode: WorkflowNode | undefined = this.edges[0];
    if (this.data.nodeType === WorkflowNodeType.Decision) {
      const nextNodeId = await this.evaluateCondition(
        this.data.condition,
        params
      );
      // return empty to choose default edge
      if (nextNodeId) {
        nextNode = this.edges.find(node => node.id === nextNodeId);
        if (!nextNode) {
          throw new Error(`No edge found for condition ${this.data.condition}`);
        }
      }
    } else if (this.data.nodeType === WorkflowNodeType.Basic) {
      if (!this.executor) {
        throw new Error(`Node ${this.name} not initialized`);
      }

      yield* this.executor.next(this.data, params, options);
    } else {
      yield {
        type: WorkflowResultType.Content,
        nodeId: this.id,
        content: params.content,
      };
    }

    yield { type: WorkflowResultType.EndRun, nextNode };
  }
}
