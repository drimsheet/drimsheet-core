import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

import { IJournalEntryDetails } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  IJournalEntryDto,
  IJournalEntryListDto,
  IJournalLineDto,
} from './journal-entry.dto';

const journalEntryDtoMapper = {
  toDto(entry: IJournalEntry): IJournalEntryDto {
    return {
      id: entry.id,
      accountingEntityId: entry.accountingEntityId,
      sourceType: entry.sourceType,
      memo: entry.memo,
      status: entry.status,
      effectiveDate: entry.effectiveDate,
      postedAt: entry.postedAt,
      voidedAt: entry.voidedAt,
      voidingEntryId: entry.voidingEntryId,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      attachments: entry.attachments.map((attachment) => ({
        url: attachment.url,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
      })),
      lines: entry.lines.map(journalEntryDtoMapper.toLineDto),
    };
  },

  toLineDto(line: IJournalLine): IJournalLineDto {
    return {
      id: line.id,
      entryId: line.entryId,
      accountId: line.accountId,
      counterpartyId: line.counterpartyId,
      sequenceOrder: line.sequenceOrder,
      amount: moneyMapper.toDto(line.amount),
      exchangeRate: line.exchangeRate,
      functionalAmount: moneyMapper.toDto(line.functionalAmount),
      side: line.side,
      description: line.description,
      createdBy: line.createdBy,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    };
  },

  toListDto(entry: IJournalEntryDetails): IJournalEntryListDto {
    return {
      id: entry.id,
      accountingEntityId: entry.accountingEntityId,
      sourceType: entry.sourceType,
      memo: entry.memo,
      status: entry.status,
      effectiveDate: entry.effectiveDate,
      postedAt: entry.postedAt,
      voidedAt: entry.voidedAt,
      voidingEntryId: entry.voidingEntryId,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      attachments: entry.attachments.map((attachment) => ({
        url: attachment.url,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
      })),
      lines: entry.lines.map((line) => ({
        id: line.id,
        entryId: line.entryId,
        account: {
          id: line.account.id,
          name: line.account.name,
        },
        counterparty: line.counterparty
          ? {
              id: line.counterparty.id,
              name: line.counterparty.name,
              status: line.counterparty.status,
            }
          : null,
        sequenceOrder: line.sequenceOrder,
        amount: moneyMapper.toDto(line.amount),
        exchangeRate: line.exchangeRate,
        functionalAmount: moneyMapper.toDto(line.functionalAmount),
        side: line.side,
        description: line.description,
        createdBy: line.createdBy,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
      })),
    };
  },
};

export default journalEntryDtoMapper;
