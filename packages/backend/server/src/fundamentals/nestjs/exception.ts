import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GqlContextType } from '@nestjs/graphql';
import { Response } from 'express';

import { InternalServerError, UserFriendlyError } from '../error';
import { metrics } from '../metrics';

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  logger = new Logger('GlobalExceptionFilter');
  override catch(exception: Error, host: ArgumentsHost) {
    let friendlyError: UserFriendlyError;
    if (exception instanceof UserFriendlyError) {
      friendlyError = exception;
    } else {
      this.logger.error(
        'Unhandled Server Error',
        exception.stack ?? exception.message
      );
      friendlyError = new InternalServerError();
    }

    // with useGlobalFilters, the context is always HTTP
    if (host.getType<GqlContextType>() === 'graphql') {
      // let Graphql LoggerPlugin handle it
      // see '../graphql/logger-plugin.ts'
      throw friendlyError;
    } else {
      const res = host.switchToHttp().getResponse<Response>();
      res.status(friendlyError.status).send(friendlyError.json());
      return;
    }
  }
}


export const GatewayErrorWrapper = (event: string): MethodDecorator => {
  // @ts-expect-error allow
  return (
    _target,
    _key,
    desc: TypedPropertyDescriptor<(...args: any[]) => any>
  ) => {
    const originalMethod = desc.value;
    if (!originalMethod) {
      return desc;
    }

    desc.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        let friendlyError: UserFriendlyError;
        if (error instanceof UserFriendlyError) {
          friendlyError = error;
        } else {
          new Logger('EventsGateway').error('Unhandled Gateway Error',
            (error as Error).stack ?? (error as Error).message
          )
          friendlyError = new InternalServerError();
        }

        metrics.socketio.counter('error').add(1, { event, status: friendlyError.status});

        return {
          error: friendlyError.json(),
        }
      }
    };

    return desc;
  };
};

