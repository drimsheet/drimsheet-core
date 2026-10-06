import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import {
  IJournalEntry,
  IJournalHeader,
} from '@domain/journal-entry/types/journal-entry.types';

import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

import { journalEntriesInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';

import journalEntryAttachmentMapper, {
  IJournalEntryAttachmentModel,
} from './journal-entry-attachment.mapper';
import journalLineMapper, { IJournalLineModel } from './journal-line.mapper';

export type IJournalEntryModel = InferSelectModel<typeof journalEntriesInCore>;

interface IJournalEntrySelectModel extends IJournalEntryModel {
  journalEntryAttachmentsInCores: IJournalEntryAttachmentModel[];
  journalLinesInCores: IJournalLineModel[];
}

const emptyAttachments: IJournalEntry['attachments'] = [];
Object.freeze(emptyAttachments);

const journalEntryMapper = {
  toDomain(payload: IJournalEntrySelectModel): IJournalEntry {
    return {
      id: payload.id as TEntityId,
      accountingEntityId: payload.accountingEntityId as TEntityId,
      sourceType: payload.sourceType,
      memo: payload.memo,
      status: payload.status,
      attachments: payload.journalEntryAttachmentsInCores[0]
        ? journalEntryAttachmentMapper.toDomain(
            payload.journalEntryAttachmentsInCores[0]
          )
        : emptyAttachments,
      lines: payload.journalLinesInCores.map((line) =>
        journalLineMapper.toDomain(line)
      ),
      effectiveDate: fromRepoDate(payload.effectiveDate),
      postedAt: payload.postedAt ? fromRepoDate(payload.postedAt) : null,
      voidedAt: payload.voidedAt ? fromRepoDate(payload.voidedAt) : null,
      voidingEntryId: payload.voidingEntryId as TEntityId,
      version: payload.version,
      createdBy: payload.createdBy as TEntityId,
      createdAt: fromRepoDate(payload.createdAt),
      updatedAt: fromRepoDate(payload.updatedAt),
    };
  },

  toRepo(payload: IJournalHeader): Omit<IJournalEntryModel, 'transactionId'> {
    return {
      id: payload.id,
      accountingEntityId: payload.accountingEntityId,
      sourceType: payload.sourceType,
      memo: payload.memo,
      status: payload.status,
      effectiveDate: toRepoDate(payload.effectiveDate),
      postedAt: payload.postedAt ? toRepoDate(payload.postedAt) : null,
      voidedAt: payload.voidedAt ? toRepoDate(payload.voidedAt) : null,
      voidingEntryId: payload.voidingEntryId,
      version: payload.version,
      createdBy: payload.createdBy,
      createdAt: toRepoDate(payload.createdAt),
      updatedAt: toRepoDate(payload.updatedAt),
    };
  },

  toDto(payload: IJournalEntry): IJournalEntryDto {
    return {
      id: payload.id,
      accountingEntityId: payload.accountingEntityId,
      sourceType: payload.sourceType,
      attachments: payload.attachments,
      lines: payload.lines.map(journalLineMapper.toDto),
      memo: payload.memo,
      status: payload.status,
      effectiveDate: payload.effectiveDate,
      postedAt: payload.postedAt,
      voidedAt: payload.voidedAt,
      voidingEntryId: payload.voidingEntryId,
      createdBy: payload.createdBy,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  },
};

export default journalEntryMapper;
