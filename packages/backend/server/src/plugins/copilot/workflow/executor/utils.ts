import { Logger, OnModuleInit } from '@nestjs/common';

import { WorkflowExecutor, type WorkflowExecutorType } from './types';

const WORKFLOW_EXECUTOR: Map<string, WorkflowExecutor> = new Map();

function registerWorkflowExecutor(e: WorkflowExecutor) {
  WORKFLOW_EXECUTOR.set(e.type, e);
}

export function getWorkflowExecutor(
  type: WorkflowExecutorType
): WorkflowExecutor {
  const executor = WORKFLOW_EXECUTOR.get(type);
  if (!executor) {
    throw new Error(`Executor ${type} not defined`);
  }

  return executor;
}

export abstract class AutoRegisteredWorkflowExecutor
  extends WorkflowExecutor
  implements OnModuleInit
{
  onModuleInit() {
    registerWorkflowExecutor(this);
    new Logger(`CopilotWorkflowExecutor:${this.type}`).log(
      'Workflow executor registered.'
    );
  }
}
