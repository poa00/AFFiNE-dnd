import { NodeData } from '../types';
import {
  WorkflowExecutor,
  WorkflowExecutorDefinition,
  WorkflowExecutorType,
} from './types';

const WORKFLOW_EXECUTOR: Map<string, WorkflowExecutorDefinition> = new Map();

export function registerWorkflowExecutor(e: WorkflowExecutorDefinition) {
  WORKFLOW_EXECUTOR.set(e.type, e);
}

export async function getWorkflowExecutor(
  type: WorkflowExecutorType,
  data: NodeData
): Promise<WorkflowExecutor> {
  const executor = WORKFLOW_EXECUTOR.get(type);
  if (!executor) {
    throw new Error(`Executor ${type} not defined`);
  }
  const instance = new executor(data);
  return instance;
}
