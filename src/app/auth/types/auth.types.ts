import { TEntityId } from '@shared/types/uuid';

export const EAuthStrategy = {
  Email: 'email',
  Google: 'google',
} as const;

export type UAuthStrategy = (typeof EAuthStrategy)[keyof typeof EAuthStrategy];

export interface IUserAuth {
  createdBy: TEntityId;
  userId: TEntityId;
  password: string | null;
  failedLoginAttempts: number;
  strategy: UAuthStrategy[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSession {
  createdBy: TEntityId;
  id: TEntityId;
  userId: TEntityId;
  refreshToken: string;
  lastLoginAt: Date;
  createdAt: Date;
}
