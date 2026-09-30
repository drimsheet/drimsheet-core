import { TEntityId } from '@shared/types/uuid';

import {
  IJournalEntryDetails,
  IJournalLineDetails,
} from '@app/journal-entry/contracts/journal-entry.query.repo.contract';

import { fromRepoDate } from '@infra/persistence/helpers/date.mapper';
import { ICounterpartyModel } from '@infra/persistence/repos/counterparty/mappers/counterparty.mapper';
import { ILedgerAccountModel } from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';

import journalEntryAttachmentMapper, {
  IJournalEntryAttachmentModel,
} from './journal-entry-attachment.mapper';
import { IJournalEntryModel } from './journal-entry.mapper';
import journalLineMapper, { IJournalLineModel } from './journal-line.mapper';

interface IJournalLineDetailsModel extends IJournalLineModel {
  ledgerAccountsInCore: Pick<ILedgerAccountModel, 'id' | 'name'>;
  counterpartiesInCore: Pick<
    ICounterpartyModel,
    'id' | 'name' | 'status'
  > | null;
}

interface IJournalEntryDetailsModel extends IJournalEntryModel {
  journalEntryAttachmentsInCores: IJournalEntryAttachmentModel[];
  journalLinesInCores: IJournalLineDetailsModel[];
}

function toLineDetails(payload: IJournalLineDetailsModel): IJournalLineDetails {
  const line = journalLineMapper.toDomain(payload);

  return {
    createdBy: line.createdBy as TEntityId,
    id: line.id,
    entryId: line.entryId,
    accountId: line.accountId,
    counterpartyId: line.counterpartyId,
    sequenceOrder: line.sequenceOrder,
    amount: line.amount,
    exchangeRate: line.exchangeRate,
    functionalAmount: line.functionalAmount,
    side: line.side,
    description: line.description,
    meta: line.meta,
    version: line.version,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
    account: {
      id: payload.ledgerAccountsInCore.id as TEntityId,
      name: payload.ledgerAccountsInCore.name,
    },
    counterparty: payload.counterpartiesInCore
      ? {
          id: payload.counterpartiesInCore.id as TEntityId,
          name: payload.counterpartiesInCore.name,
          status: payload.counterpartiesInCore.status,
        }
      : null,
  };
}

const journalEntryDetailsMapper = {
  toDetails(payload: IJournalEntryDetailsModel): IJournalEntryDetails {
    return {
      id: payload.id as TEntityId,
      accountingEntityId: payload.accountingEntityId as TEntityId,
      sourceType: payload.sourceType,
      memo: payload.memo,
      status: payload.status,
      effectiveDate: fromRepoDate(payload.effectiveDate),
      postedAt: payload.postedAt ? fromRepoDate(payload.postedAt) : null,
      voidedAt: payload.voidedAt ? fromRepoDate(payload.voidedAt) : null,
      voidingEntryId: (payload.voidingEntryId as TEntityId) ?? null,
      version: payload.version,
      createdBy: payload.createdBy as TEntityId,
      createdAt: fromRepoDate(payload.createdAt),
      updatedAt: fromRepoDate(payload.updatedAt),
      attachments: payload.journalEntryAttachmentsInCores[0]
        ? journalEntryAttachmentMapper.toDomain(
            payload.journalEntryAttachmentsInCores[0]
          )
        : [],
      lines: payload.journalLinesInCores.map(toLineDetails),
    };
  },
};

export default journalEntryDetailsMapper;
