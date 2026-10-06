import { TEntityId } from '@shared/types/uuid';

import { IAccountTransaction } from '@domain/journal-entry/types/account-transaction.types';

import { IAccountTransactionDto } from '@app/ledger/dtos/account-transaction/account-transaction.dto';

import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';
import { IJournalEntryModel } from '@infra/persistence/repos/journal-entry/mappers/journal-entry.mapper';
import journalLineMapper, {
  IJournalLineModel,
} from '@infra/persistence/repos/journal-entry/mappers/journal-line.mapper';

const accountTransactionMapper = {
  toDomain(payload: {
    line: IJournalLineModel;
    header: IJournalEntryModel;
  }): IAccountTransaction {
    return {
      ...journalLineMapper.toDomain(payload.line),
      header: {
        sourceType: payload.header.sourceType,
        memo: payload.header.memo,
        status: payload.header.status,
        effectiveDate: fromRepoDate(payload.header.effectiveDate),
        postedAt: payload.header.postedAt
          ? fromRepoDate(payload.header.postedAt)
          : null,
        voidedAt: payload.header.voidedAt
          ? fromRepoDate(payload.header.voidedAt)
          : null,
        voidingEntryId: (payload.header.voidingEntryId as TEntityId) ?? null,
        version: payload.header.version,
        createdBy: payload.header.createdBy as TEntityId,
        createdAt: fromRepoDate(payload.header.createdAt),
        updatedAt: fromRepoDate(payload.header.updatedAt),
      },
    };
  },

  toDto(payload: IAccountTransaction): IAccountTransactionDto {
    return {
      ...journalLineMapper.toDto(payload),
      header: {
        sourceType: payload.header.sourceType,
        memo: payload.header.memo,
        status: payload.header.status,
        effectiveDate: payload.header.effectiveDate,
        postedAt: payload.header.postedAt,
        voidedAt: payload.header.voidedAt,
        voidingEntryId: payload.header.voidingEntryId,
        createdBy: payload.header.createdBy,
        createdAt: payload.header.createdAt,
        updatedAt: payload.header.updatedAt,
      },
    };
  },
};

export default accountTransactionMapper;
