import { PromptService } from '../../prompt';
import { CopilotProviderService } from '../../providers';
import { CopilotChatOptions } from '../../types';
import { NodeData, WorkflowResult } from '../types';

export enum WorkflowExecutorType {
  ChatText = 'ChatText',
}

export abstract class WorkflowExecutor {
  static type: WorkflowExecutorType;
  abstract initExecutor(
    data: NodeData,
    prompt: PromptService,
    provider: CopilotProviderService
  ): Promise<void>;
  abstract next(
    params: Record<string, string>,
    options?: CopilotChatOptions
  ): AsyncIterable<WorkflowResult>;
}

export interface WorkflowExecutorDefinition {
  new (data: NodeData): WorkflowExecutor;
  type: WorkflowExecutorType;
}
