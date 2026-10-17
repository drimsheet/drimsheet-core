import { ICorrelationId } from '@shared/types/correlation-id.types';
import { IIdempotencyKey } from '@shared/types/idempotency-key.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IActor } from '@domain/user/types/actor.types';
import { IUser } from '@domain/user/types/user.types';

export interface IClientSession {
  setRefreshToken(token: string): void;
  getRefreshToken(): string | null;
  clearRefreshToken(): void;
}

export interface IAppContextData extends ICorrelationId, IIdempotencyKey {
  /** User subject for identity, ownership, preferences, and upload workflows. */
  user?: IUser;
  /** Verified caller resolved at the entry boundary; source of write attribution. */
  actor?: IActor;
  accountingEntity?: IAccountingEntity;
  clientSession?: IClientSession;
}
