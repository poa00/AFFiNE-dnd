import type { WorkflowExecutorType } from './executor';
import type { WorkflowNode } from './node';

export enum WorkflowNodeType {
  Basic = 'basic',
  Decision = 'decision',
}

export type NodeData = { id: string; name: string } & (
  | {
      nodeType: WorkflowNodeType.Basic;
      promptName: string;
      type: WorkflowExecutorType;
      // update the prompt params by output with the custom key
      paramKey?: string;
    }
  | { nodeType: WorkflowNodeType.Decision; condition: string }
);

export type WorkflowNodeState = Record<string, string>;

export type WorkflowGraphData = Array<NodeData & { edges: string[] }>;
export type WorkflowGraphList = Array<{
  name: string;
  graph: WorkflowGraphData;
}>;

export enum WorkflowResultType {
  StartRun,
  EndRun,
  Params,
  Content,
}

export type WorkflowResult =
  | { type: WorkflowResultType.StartRun; nodeId: string }
  | { type: WorkflowResultType.EndRun; nextNode?: WorkflowNode }
  | {
      type: WorkflowResultType.Params;
      params: Record<string, string | string[]>;
    }
  | {
      type: WorkflowResultType.Content;
      nodeId: string;
      content: string;
    };

export type WorkflowGraph = Map<string, WorkflowNode>;
