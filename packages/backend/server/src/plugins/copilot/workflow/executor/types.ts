import { CopilotChatOptions } from '../../types';
import { WorkflowResult } from '../types';

export enum WorkflowExecutorType {
  ChatText = 'ChatText',
}

export abstract class WorkflowExecutor {
  abstract get type(): WorkflowExecutorType;
  abstract next(
    params: Record<string, string>,
    options?: CopilotChatOptions
  ): AsyncIterable<WorkflowResult>;
}
