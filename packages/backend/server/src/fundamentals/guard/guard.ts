import {
  CanActivate,
  ExecutionContext,
  Injectable,
  OnModuleInit,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';

import { GUARD_PROVIDER } from './provider';

const BasicGuardSymbol = Symbol('BasicGuard');

@Injectable()
export class BasicGuard implements CanActivate, OnModuleInit {
  constructor(
    private readonly ref: ModuleRef,
    private readonly reflector: Reflector
  ) {}

  onModuleInit() {}

  async canActivate(context: ExecutionContext) {
    // api is public
    const providerName = this.reflector.get<string>(
      BasicGuardSymbol,
      context.getHandler()
    );

    const provider = GUARD_PROVIDER[providerName];
    if (provider) {
      return await provider.canActivate(context);
    }

    return true;
  }
}

/**
 * This guard is used to protect routes/queries/mutations that require a user to be logged in.
 *
 * The `@CurrentUser()` parameter decorator used in a `Auth` guarded queries would always give us the user because the `Auth` guard will
 * fast throw if user is not logged in.
 *
 * @example
 *
 * ```typescript
 * \@Auth()
 * \@Query(() => UserType)
 * user(@CurrentUser() user: CurrentUser) {
 *   return user;
 * }
 * ```
 */
export const UseBasicGuard = () => {
  return UseGuards(BasicGuard);
};

// api is public accessible
export const Guard = (name: string) => SetMetadata(BasicGuardSymbol, name);
