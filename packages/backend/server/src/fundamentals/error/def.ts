import { STATUS_CODES } from 'node:http';

import { HttpStatus } from '@nestjs/common';
import { capitalize } from 'lodash-es';

export type UserFriendlyErrorBaseType =
  | 'internal_server_error'
  | 'resource_not_found'
  | 'resource_already_exists'
  | 'invalid_input'
  | 'action_forbidden'
  | 'no_permission'
  | 'quota_exceeded'
  | 'authentication_required';

type ErrorArgType = 'string' | 'number' | 'boolean';
type ErrorArgs = Record<string, ErrorArgType | Record<string, ErrorArgType>>;

export type UserFriendlyErrorOptions = {
  type: UserFriendlyErrorBaseType;
  status?: HttpStatus;
  args?: ErrorArgs;
  message: string | ((args: any) => string);
};

export class UserFriendlyError extends Error {
  /**
   * Standard HTTP status code
   */
  status: number;

  /**
   * Business error category, for example 'resource_already_exists' or 'quota_exceeded'
   */
  type: string;

  /**
   * Specific error code that could be used for i18n or message formatting, for example 'subscription_already_exists' or 'blob_quota_exceeded'
   */
  code: string;

  /**
   * Additional data that could be used for error handling or formatting
   */
  data: any;

  constructor(code: string, args?: any) {
    // @ts-expect-error allow
    const options: UserFriendlyErrorOptions = USER_FRIENDLY_ERRORS[code];

    const message =
      typeof options.message === 'function'
        ? options.message(args)
        : options.message;
    super(message);
    this.message = message;
    this.type = options.type;
    this.status = options.status ?? HttpStatus.BAD_REQUEST;
    this.code = code;
    this.data = args;
  }

  json() {
    return {
      statusCode: this.status,
      status: STATUS_CODES[this.status] ?? 'BAD REQUEST',
      type: this.type.toUpperCase(),
      code: this.code.toUpperCase(),
      message: this.message,
      data: this.data,
    };
  }
}

/**
 *
 * @ObjectType()
 * export class XXXErrorDataType {
 *   @Field()
 *
 * }
 */
function generateErrorArgs(name: string, args: ErrorArgs) {
  const typeName = `${name}DataType`;
  const lines = [`@ObjectType()`, `class ${typeName} {`];
  Object.entries(args).forEach(([arg, fieldArgs]) => {
    if (typeof fieldArgs === 'object') {
      const subResult = generateErrorArgs(
        name + 'Field' + capitalize(arg),
        fieldArgs
      );
      lines.unshift(subResult.def);
      lines.push(
        `  @Field(() => ${subResult.name}) ${arg}!: ${subResult.name};`
      );
    } else {
      lines.push(`  @Field() ${arg}!: ${fieldArgs}`);
    }
  });

  lines.push('}');

  return { name: typeName, def: lines.join('\n') };
}

export function generateUserFriendlyErrors() {
  const output = [
    '// AUTO GENERATED FILE',
    `import { createUnionType, Field, ObjectType, registerEnumType } from '@nestjs/graphql';`,
    '',
    `import { UserFriendlyError } from './def';`,
  ];

  const errorNames: string[] = [];
  const argTypes: string[] = [];

  for (const code in USER_FRIENDLY_ERRORS) {
    // @ts-expect-error allow
    const options: UserFriendlyErrorOptions = USER_FRIENDLY_ERRORS[code];
    const className = code
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    errorNames.push(className);

    const args = options.args
      ? generateErrorArgs(className, options.args)
      : null;

    const classDef = `
export class ${className} extends UserFriendlyError {
  constructor(${args ? `args: ${args.name}` : ''}) {
    super('${code}'${args ? ', args' : ''});
  }
}`;

    if (args) {
      output.push(args.def);
      argTypes.push(args.name);
    }
    output.push(classDef);
  }

  output.push(`
export enum Errors {
  ${errorNames.join(',\n  ')}
}

registerEnumType(Errors, {
  name: 'Errors',
})
`);

  output.push(`export const ErrorDataUnionType = createUnionType({
  name: 'ErrorDataUnion',
  types: () =>
    [${argTypes.join(', ')}] as const,
});
`);

  return output.join('\n');
}

// DEFINE ALL USER FRIENDLY ERRORS HERE
export const USER_FRIENDLY_ERRORS = {
  // Internal uncaught errors
  internal_server_error: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    type: 'internal_server_error',
    message: 'An internal error occurred.',
  },

  // User Errors
  user_not_found: {
    type: 'resource_not_found',
    message: 'User not found.',
  },
  email_already_used: {
    type: 'resource_already_exists',
    message: 'This email has already been registered.',
  },
  wrong_sign_in_credentials: {
    type: 'invalid_input',
    message: 'Wrong user email or password.',
  },
  invalid_email: {
    type: 'invalid_input',
    message: 'An invalid email provided.',
  },
  invalid_password_length: {
    type: 'invalid_input',
    args: { min: 'number', max: 'number' },
    message: ({ min, max }) =>
      `Password must be between ${min} and ${max} characters`,
  },
  wrong_sign_in_method: {
    type: 'invalid_input',
    message:
      'You are trying to sign in by a different method than you signed up with.',
  },

  // Authentication & Permission Errors
  authentication_required: {
    status: HttpStatus.UNAUTHORIZED,
    type: 'authentication_required',
    message: 'You must sign in first to access this resource.',
  },
  action_forbidden: {
    status: HttpStatus.FORBIDDEN,
    type: 'action_forbidden',
    message: 'You are not allowed to perform this action.',
  },
  access_denied: {
    status: HttpStatus.FORBIDDEN,
    type: 'no_permission',
    message: 'You do not have permission to access this resource.',
  },

  // Doc & Sync errors
  workspace_not_found: {
    status: HttpStatus.NOT_FOUND,
    type: 'resource_not_found',
    args: { workspaceId: 'string' },
    message: ({ workspaceId }) =>
      `You are trying to access an unknown workspace ${workspaceId}.`,
  },
  not_in_workspace: {
    type: 'action_forbidden',
    args: { workspaceId: 'string' },
    message: ({ workspaceId }) =>
      `You should join in workspace ${workspaceId} before broadcasting messages.`,
  },
  doc_not_found: {
    status: HttpStatus.NOT_FOUND,
    type: 'resource_not_found',
    args: { workspaceId: 'string', docId: 'string' },
    message: ({ workspaceId, docId }) =>
      `You are trying to access an unknown doc ${docId} under workspace ${workspaceId}.`,
  },
  version_rejected: {
    type: 'action_forbidden',
    args: { version: 'number' },
    message: ({ version }) =>
      `The version ${version} is rejected by remote sync server.`,
  },

  // Subscription Errors
  subscription_already_exists: {
    type: 'resource_already_exists',
    args: { plan: 'string' },
    message: ({ plan }) => `You have already subscribed to the ${plan} plan.`,
  },
  subscription_not_exists: {
    type: 'resource_not_found',
    args: { plan: 'string' },
    message: ({ plan }) => `You didn't subscribe to the ${plan} plan.`,
  },
  subscription_has_been_canceled: {
    type: 'action_forbidden',
    message: 'Your subscription has already been canceled.',
  },
  subscription_expired: {
    type: 'action_forbidden',
    message: 'Your subscription has expired.',
  },
  subscription_recurring_exists: {
    type: 'resource_already_exists',
    args: { recurring: 'string' },
    message: ({ recurring }) =>
      `Your subscription has already been in ${recurring} recurring state.`,
  },
  customer_portal_create_failed: {
    type: 'internal_server_error',
    message: 'Failed to create customer portal session.',
  },
  subscription_plan_not_found: {
    type: 'resource_not_found',
    args: { plan: 'string', recurring: 'string' },
    message: 'You are trying to access a unknown subscription plan.',
  },

  // Quota & Limit errors
  blob_quota_exceeded: {
    type: 'quota_exceeded',
    args: { limit: 'number' },
    message: 'You have exceeded your blob storage quota.',
  },
  member_quota_exceeded: {
    type: 'quota_exceeded',
    args: { limit: 'number' },
    message: 'You have exceeded your workspace member quota.',
  },
} satisfies Record<string, UserFriendlyErrorOptions>;
