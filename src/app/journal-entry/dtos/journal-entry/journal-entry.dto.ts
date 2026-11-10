import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import { UCounterpartyStatus } from '@domain/counterparty/types/counterparty.types';
import {
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { UJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { ULedgerType } from '@domain/ledger/types/ledger.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';

import { UJournalEntrySortBy } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetJournalEntriesQuery extends IPaginationDto {
  /** Inclusive timestamp with a timezone and at most 3 fractional digits. */
  createdAtFrom?: string;
  /** Inclusive timestamp with a timezone and at most 3 fractional digits. */
  createdAtTo?: string;
  /** Inclusive calendar date in YYYY-MM-DD format. */
  effectiveDateFrom?: string;
  /** Inclusive calendar date in YYYY-MM-DD format. */
  effectiveDateTo?: string;
  /** Inclusive timestamp with a timezone and at most 3 fractional digits. */
  updatedAtFrom?: string;
  /** Inclusive timestamp with a timezone and at most 3 fractional digits. */
  updatedAtTo?: string;
  /** Matches transaction currency on any line, independently of other filters. */
  currencyCode?: string;
  /** Matches account type on any line, independently of other filters. */
  accountType?: ULedgerType;
  accountId?: string;
  counterpartyId?: string;
  orderBy?: UJournalEntrySortBy;
  status?: 'posted' | 'archived';
  /** Reversal entries are excluded from this listing. */
  sourceType?: Exclude<UJournalEntrySourceType, 'reversal'>;
}

export interface IJournalLineReq {
  accountId: string;
  counterpartyId: string | null;
  amount: IMoneyDto;
  exchangeRate: IExchangeRateDto | null;
  description: string | null;
  sequenceOrder: number;
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
  createdAt: Date;
  updatedAt: Date;
}

interface IJournalHeaderFieldsDto {
  sourceType: UJournalEntrySourceType;
  memo: string | null;
  status: UJournalEntryStatus;
  postedAt: Date | null;
  voidedAt: Date | null;
  voidingEntryId: string | null;
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalHeaderDto extends IJournalHeaderFieldsDto {
  effectiveDate: Date;
}

interface IJournalEntryFieldsDto extends IJournalHeaderFieldsDto {
  id: string;
  accountingEntityId: string;
  attachments: IFileAttachment[];
  lines: IJournalLineDto[];
}

export interface IJournalEntryDto extends IJournalEntryFieldsDto {
  effectiveDate: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalEntryListDto extends IJournalHeaderDto {
  id: string;
  accountingEntityId: string;
  attachments: IFileAttachment[];
  lines: IJournalLineListDto[];
}
