import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import {
  UCounterpartyStatus,
  UCounterpartyType,
} from '@domain/counterparty/types/counterparty.types';
import {
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { UJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';

import { UJournalEntrySortBy } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetJournalEntriesQuery extends IPaginationDto {
  accountId?: string;
  counterpartyId?: string;
  orderBy?: UJournalEntrySortBy;
  status?: 'posted' | 'archived';
}

export interface IJournalLineReq {
  accountId: string;
  counterparty: IJournalCounterpartyReq | null;
  amount: IMoneyDto;
  exchangeRate: IExchangeRateDto | null;
  description: string | null;
  sequenceOrder: number;
}

export interface IJournalCounterpartyReq {
  id?: string;
  name: string;
  type?: UCounterpartyType;
}

export interface IJournalLineDto {
  createdBy: TEntityId;
  id: string;
  entryId: string;
  accountId: string;
  counterpartyId: string | null;
  sequenceOrder: number;
  amount: IMoneyDto;
  exchangeRate: IExchangeRate | null;
  functionalAmount: IMoneyDto;
  side: UJournalSide;
  description: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalHeaderDto {
  sourceType: UJournalEntrySourceType;
  memo: string | null;
  status: UJournalEntryStatus;
  effectiveDate: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
  voidingEntryId: string | null;
  version: number;
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalEntryDto extends IJournalHeaderDto {
  id: string;
  accountingEntityId: string;
  attachments: IFileAttachment[];
  lines: IJournalLineDto[];
}

interface IJournalLineListDto {
  id: string;
  entryId: string;
  account: {
    id: string;
    name: string;
  };
  counterparty: {
    id: string;
    name: string;
    status: UCounterpartyStatus;
  } | null;
  sequenceOrder: number;
  amount: IMoneyDto;
  exchangeRate: IExchangeRate | null;
  functionalAmount: IMoneyDto;
  side: UJournalSide;
  description: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalEntryListDto extends IJournalHeaderDto {
  id: string;
  accountingEntityId: string;
  attachments: IFileAttachment[];
  lines: IJournalLineListDto[];
}
