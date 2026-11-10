import { TEntityId } from '@shared/types/uuid';

export const EOutboxType = {
  MissingOfficialFxRate: 'missing_official_fx_rate',
} as const;

export type UOutboxType = (typeof EOutboxType)[keyof typeof EOutboxType];

export interface IOutbox {
  id: TEntityId;
  correlationId: string;
  type: UOutboxType;
  data: unknown;
  createdAt: Date;
}

export interface ICreateOutbox {
  id: TEntityId;
  correlationId: string;
  type: UOutboxType;
  data: unknown;
}
