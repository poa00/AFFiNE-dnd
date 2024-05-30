// AUTO GENERATED FILE
import { createUnionType, Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { UserFriendlyError } from './def';

export class InternalServerError extends UserFriendlyError {
  constructor() {
    super('internal_server_error');
  }
}

export class UserNotFound extends UserFriendlyError {
  constructor() {
    super('user_not_found');
  }
}

export class EmailAlreadyUsed extends UserFriendlyError {
  constructor() {
    super('email_already_used');
  }
}

export class WrongSignInCredentials extends UserFriendlyError {
  constructor() {
    super('wrong_sign_in_credentials');
  }
}

export class InvalidEmail extends UserFriendlyError {
  constructor() {
    super('invalid_email');
  }
}
@ObjectType()
class InvalidPasswordLengthDataType {
  @Field() min!: number
  @Field() max!: number
}

export class InvalidPasswordLength extends UserFriendlyError {
  constructor(args: InvalidPasswordLengthDataType) {
    super('invalid_password_length', args);
  }
}

export class WrongSignInMethod extends UserFriendlyError {
  constructor() {
    super('wrong_sign_in_method');
  }
}

export class AuthenticationRequired extends UserFriendlyError {
  constructor() {
    super('authentication_required');
  }
}

export class ActionForbidden extends UserFriendlyError {
  constructor() {
    super('action_forbidden');
  }
}

export class AccessDenied extends UserFriendlyError {
  constructor() {
    super('access_denied');
  }
}
@ObjectType()
class WorkspaceNotFoundDataType {
  @Field() workspaceId!: string
}

export class WorkspaceNotFound extends UserFriendlyError {
  constructor(args: WorkspaceNotFoundDataType) {
    super('workspace_not_found', args);
  }
}
@ObjectType()
class NotInWorkspaceDataType {
  @Field() workspaceId!: string
}

export class NotInWorkspace extends UserFriendlyError {
  constructor(args: NotInWorkspaceDataType) {
    super('not_in_workspace', args);
  }
}
@ObjectType()
class DocNotFoundDataType {
  @Field() workspaceId!: string
  @Field() docId!: string
}

export class DocNotFound extends UserFriendlyError {
  constructor(args: DocNotFoundDataType) {
    super('doc_not_found', args);
  }
}
@ObjectType()
class VersionRejectedDataType {
  @Field() version!: number
}

export class VersionRejected extends UserFriendlyError {
  constructor(args: VersionRejectedDataType) {
    super('version_rejected', args);
  }
}
@ObjectType()
class SubscriptionAlreadyExistsDataType {
  @Field() plan!: string
}

export class SubscriptionAlreadyExists extends UserFriendlyError {
  constructor(args: SubscriptionAlreadyExistsDataType) {
    super('subscription_already_exists', args);
  }
}
@ObjectType()
class SubscriptionNotExistsDataType {
  @Field() plan!: string
}

export class SubscriptionNotExists extends UserFriendlyError {
  constructor(args: SubscriptionNotExistsDataType) {
    super('subscription_not_exists', args);
  }
}

export class SubscriptionHasBeenCanceled extends UserFriendlyError {
  constructor() {
    super('subscription_has_been_canceled');
  }
}

export class SubscriptionExpired extends UserFriendlyError {
  constructor() {
    super('subscription_expired');
  }
}
@ObjectType()
class SubscriptionRecurringExistsDataType {
  @Field() recurring!: string
}

export class SubscriptionRecurringExists extends UserFriendlyError {
  constructor(args: SubscriptionRecurringExistsDataType) {
    super('subscription_recurring_exists', args);
  }
}

export class CustomerPortalCreateFailed extends UserFriendlyError {
  constructor() {
    super('customer_portal_create_failed');
  }
}
@ObjectType()
class SubscriptionPlanNotFoundDataType {
  @Field() plan!: string
  @Field() recurring!: string
}

export class SubscriptionPlanNotFound extends UserFriendlyError {
  constructor(args: SubscriptionPlanNotFoundDataType) {
    super('subscription_plan_not_found', args);
  }
}
@ObjectType()
class BlobQuotaExceededDataType {
  @Field() limit!: number
}

export class BlobQuotaExceeded extends UserFriendlyError {
  constructor(args: BlobQuotaExceededDataType) {
    super('blob_quota_exceeded', args);
  }
}
@ObjectType()
class MemberQuotaExceededDataType {
  @Field() limit!: number
}

export class MemberQuotaExceeded extends UserFriendlyError {
  constructor(args: MemberQuotaExceededDataType) {
    super('member_quota_exceeded', args);
  }
}

export enum Errors {
  InternalServerError,
  UserNotFound,
  EmailAlreadyUsed,
  WrongSignInCredentials,
  InvalidEmail,
  InvalidPasswordLength,
  WrongSignInMethod,
  AuthenticationRequired,
  ActionForbidden,
  AccessDenied,
  WorkspaceNotFound,
  NotInWorkspace,
  DocNotFound,
  VersionRejected,
  SubscriptionAlreadyExists,
  SubscriptionNotExists,
  SubscriptionHasBeenCanceled,
  SubscriptionExpired,
  SubscriptionRecurringExists,
  CustomerPortalCreateFailed,
  SubscriptionPlanNotFound,
  BlobQuotaExceeded,
  MemberQuotaExceeded
}

registerEnumType(Errors, {
  name: 'Errors',
})

export const ErrorDataUnionType = createUnionType({
  name: 'ErrorDataUnion',
  types: () =>
    [InvalidPasswordLengthDataType, WorkspaceNotFoundDataType, NotInWorkspaceDataType, DocNotFoundDataType, VersionRejectedDataType, SubscriptionAlreadyExistsDataType, SubscriptionNotExistsDataType, SubscriptionRecurringExistsDataType, SubscriptionPlanNotFoundDataType, BlobQuotaExceededDataType, MemberQuotaExceededDataType] as const,
});
