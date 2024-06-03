import { ChatPrompt, PromptService } from '../../prompt';
import { CopilotProviderService } from '../../providers';
import { CopilotChatOptions, CopilotTextProvider } from '../../types';
import {
  NodeData,
  WorkflowNodeType,
  WorkflowResult,
  WorkflowResultType,
} from '../types';
import { WorkflowExecutor, WorkflowExecutorType } from './types';

export class CopilotChatTextExecutor extends WorkflowExecutor {
  private data: (NodeData & { nodeType: WorkflowNodeType.Basic }) | null = null;
  private prompt: ChatPrompt | null = null;
  private provider: CopilotTextProvider | null = null;

  override async initExecutor(
    data: NodeData,
    prompt: PromptService,
    provider: CopilotProviderService
  ) {
    if (this.prompt && this.provider) return;

    if (data.nodeType !== WorkflowNodeType.Basic) {
      throw new Error(
        `Executor ${this.type} not support ${data.nodeType} node`
      );
    }
    this.data = data;

    this.prompt = await prompt.get(this.data.promptName);
    if (!this.prompt) {
      throw new Error(
        `Prompt ${this.data.promptName} not found when running workflow node ${this.data.name}`
      );
    }
    const p = await provider.getProviderByModel(this.prompt.model);
    if (p && 'generateText' in p) {
      this.provider = p;
    }

    throw new Error(
      `Provider not found for model ${this.prompt.model} when running workflow node ${this.data.name}`
    );
  }

  override get type() {
    return WorkflowExecutorType.ChatText;
  }

  override async *next(
    params: Record<string, string>,
    options?: CopilotChatOptions
  ): AsyncIterable<WorkflowResult> {
    if (!this.data || !this.prompt || !this.provider) {
      throw new Error(`Node ${this.data?.name || 'unnamed'} not initialized`);
    }

    if (this.data.nodeType === WorkflowNodeType.Basic) {
      const finalMessage = this.prompt.finish(params);
      if (this.data.paramKey) {
        // update params with custom key
        yield {
          type: WorkflowResultType.Params,
          params: {
            [this.data.paramKey]: await this.provider.generateText(
              finalMessage,
              this.prompt.model,
              options
            ),
          },
        };
      } else {
        for await (const content of this.provider.generateTextStream(
          finalMessage,
          this.prompt.model,
          options
        )) {
          yield {
            type: WorkflowResultType.Content,
            nodeId: this.data.id,
            content,
          };
        }
      }
    }
  }
}
