import { InferSelectModel } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';

import {
  IJournalLine,
  IJournalLineMeta,
} from '@domain/journal-entry/types/journal-line.types';

import { IJournalLineDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

import { journalLinesInCore } from '@infra/config/drizzle/schema';
import {
  fromRepoDate,
  toRepoDate,
} from '@infra/persistence/helpers/date.mapper';
import moneyMapper from '@infra/persistence/helpers/money.mapper';
import exchangeRateMapper, {
  IExchangeRateModel,
} from '@infra/persistence/repos/money/mappers/exchange-rate.mapper';

export interface IJournalLineModel extends InferSelectModel<
  typeof journalLinesInCore
> {}

const journalLineMapper = {
  toDomain(payload: IJournalLineModel): IJournalLine {
    return {
      createdBy: payload.createdBy as TEntityId,
      id: payload.id as TEntityId,
      entryId: payload.entryId as TEntityId,
      accountId: payload.accountId as TEntityId,
      counterpartyId: (payload.counterpartyId as TEntityId) ?? null,
      sequenceOrder: payload.sequenceOrder,
      amount: moneyMapper.fromRepo(payload.amount, payload.currencyCode),
      exchangeRate: payload.exchangeRate
        ? exchangeRateMapper.toDomain(
            payload.exchangeRate as IExchangeRateModel
          )
        : null,
      functionalAmount: moneyMapper.fromRepo(
        payload.functionalAmount,
        payload.functionalCurrencyCode
      ),
      side: payload.side,
      description: payload.description,
      meta: payload.meta as IJournalLineMeta,
      version: payload.version,
      createdAt: fromRepoDate(payload.createdAt),
      updatedAt: fromRepoDate(payload.updatedAt),
    };
  },

  toRepo(payload: IJournalLine): IJournalLineModel {
    return {
      createdBy: payload.createdBy as TEntityId,
      id: payload.id,
      entryId: payload.entryId,
      accountId: payload.accountId,
      counterpartyId: payload.counterpartyId,
      sequenceOrder: payload.sequenceOrder,
      ...moneyMapper.toRepo(payload.amount),
      exchangeRate: payload.exchangeRate,
      functionalAmount: moneyMapper.toRepo(payload.functionalAmount).amount,
      functionalCurrencyCode: payload.functionalAmount.currency.code,
      side: payload.side,
      description: payload.description,
      meta: payload.meta,
      version: payload.version,
      createdAt: toRepoDate(payload.createdAt),
      updatedAt: toRepoDate(payload.updatedAt),
    };
  },

  toDto(payload: IJournalLine): IJournalLineDto {
    return {
      createdBy: payload.createdBy as TEntityId,
      id: payload.id,
      entryId: payload.entryId,
      accountId: payload.accountId,
      counterpartyId: payload.counterpartyId,
      sequenceOrder: payload.sequenceOrder,
      amount: moneyMapper.toDto(payload.amount),
      exchangeRate: payload.exchangeRate,
      functionalAmount: moneyMapper.toDto(payload.functionalAmount),
      side: payload.side,
      description: payload.description,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  },
};

export default journalLineMapper;
