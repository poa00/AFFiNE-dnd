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
  private readonly edges: WorkflowNode[] = [];
  private readonly parents: WorkflowNode[] = [];
  private readonly executor: WorkflowExecutor | null = null;

  constructor(private readonly data: NodeData) {
    if (data.nodeType === WorkflowNodeType.Basic) {
      this.executor = getWorkflowExecutor(data.type);
    }
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
    } else if (!this.data.condition) {
      throw new Error(`Decision block must have a condition`);
    }
    node.parent = this;
    this.edges.push(node);
    return this.edges.length;
  }

  private async evaluateCondition(
    _condition?: string
  ): Promise<string | undefined> {
    // todo: evaluate condition to impl decision block
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
      const nextNodeId = await this.evaluateCondition(this.data.condition);
      // return empty to choose default edge
      if (nextNodeId) {
        nextNode = this.edges.find(node => node.id === nextNodeId);
        if (!nextNode) {
          throw new Error(`No edge found for condition ${this.data.condition}`);
        }
      }
    } else {
      if (!this.executor) {
        throw new Error(`Node ${this.name} not initialized`);
      }

      yield* this.executor.next(params, options);
    }

    yield { type: WorkflowResultType.EndRun, nextNode };
  }
}
