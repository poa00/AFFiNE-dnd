import {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

import { UserFriendlyError } from '../error/def';
import { metrics } from '../metrics/metrics';

export interface RequestContext {
  req: Express.Request & {
    res: Express.Response;
  };
}

@Plugin()
export class GQLLoggerPlugin implements ApolloServerPlugin {
  protected logger = new Logger(GQLLoggerPlugin.name);

  requestDidStart(
    ctx: GraphQLRequestContext<RequestContext>
  ): Promise<GraphQLRequestListener<GraphQLRequestContext<RequestContext>>> {
    const res = ctx.contextValue.req.res as Response;
    const operation = ctx.request.operationName;

    metrics.gql.counter('query_counter').add(1, { operation });
    const start = Date.now();
    function endTimer() {
      return Date.now() - start;
    }

    return Promise.resolve({
      willSendResponse: () => {
        const time = endTimer();
        res.setHeader('Server-Timing', `gql;dur=${time};desc="GraphQL"`);
        metrics.gql.histogram('query_duration').record(time, { operation });
        return Promise.resolve();
      },
      didEncounterErrors: ctx => {
        ctx.errors.forEach(err => {
          // only log non-user errors
          let msg: string | undefined;
          let status = HttpStatus.INTERNAL_SERVER_ERROR;

          if (!err.originalError) {
            msg = err.toString();
          } else {
            const originalError = err.originalError;

            // do not log client errors, and put more information in the error extensions.
            if (!(originalError instanceof UserFriendlyError)) {
              if (originalError.cause && originalError.cause instanceof Error) {
                msg = originalError.cause.stack ?? originalError.cause.message;
              } else {
                msg = originalError.stack ?? originalError.message;
              }
            } else {
              status = originalError.status;
            }
          }

          if (msg) {
            this.logger.error('GraphQL Unhandled Error', msg);
          }
          metrics.gql
            .counter('query_error_counter')
            .add(1, { operation, code: status });
        });

        return Promise.resolve();
      },
    });
  }
}
