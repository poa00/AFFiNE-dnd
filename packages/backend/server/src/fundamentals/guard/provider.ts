import {
  CanActivate,
  ExecutionContext,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

export const GUARD_PROVIDER: Record<string, GuardProvider> = {};

@Injectable()
export abstract class GuardProvider implements OnModuleInit, CanActivate {
  onModuleInit() {
    GUARD_PROVIDER[this.name] = this;
  }

  abstract get name(): string;

  abstract canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}
