import { TEntityId } from '@shared/types/uuid';

export const EActorType = {
  User: 'user',
  System: 'system',
  Migration: 'migration',
  AiAgent: 'ai_agent',
} as const;

export type UActorType = (typeof EActorType)[keyof typeof EActorType];

export const EActorStatus = {
  Active: 'active',
  Disabled: 'disabled',
} as const;

export type UActorStatus = (typeof EActorStatus)[keyof typeof EActorStatus];

export interface IActor {
  id: TEntityId;
  type: UActorType;
  username: string;
  displayName: string;
  ownerActorId: TEntityId | null;
  agentName: string | null;
  status: UActorStatus;
  createdBy: TEntityId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
