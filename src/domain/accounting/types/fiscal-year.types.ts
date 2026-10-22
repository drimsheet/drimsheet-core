import { TEntityId } from '@shared/types/uuid';

export const EFiscalYearStatus = {
  Pending: 'pending',
  Open: 'open',
  Closing: 'closing',
  Closed: 'closed',
} as const;

export type UFiscalYearStatus =
  (typeof EFiscalYearStatus)[keyof typeof EFiscalYearStatus];

export interface IFiscalYear {
  id: TEntityId;
  createdBy: TEntityId;
  name: string;
  status: UFiscalYearStatus;
  accountingEntityId: TEntityId;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  updatedAt: Date;
}
