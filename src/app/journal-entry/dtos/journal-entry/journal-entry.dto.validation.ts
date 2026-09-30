import { omit } from 'lodash';
import z from 'zod';

import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import paginationError from '@shared/values/pagination/pagination.error';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  UJournalEntrySourceType,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  UJournalSide,
} from '@domain/journal-entry/types/journal-line.types';

import {
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import {
  EJournalEntrySortBy,
  UJournalEntrySortBy,
} from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import { exchangeRateDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';
import { moneyDtoValidation } from '@app/money/dtos/money/money.dto.validation';

const accountIdError = new journalLineError.InvalidAccountId().errorKey;
const counterpartyIdError = new journalLineError.InvalidCounterpartyId()
  .errorKey;
const descriptionError = new journalLineError.InvalidDescription().errorKey;
const journalSideError = new journalLineError.InvalidSide().errorKey;
const sequenceOrderError = new journalLineError.InvalidSequenceOrder().errorKey;

const sourceTypeError = new journalEntryError.InvalidSourceType().errorKey;
const journalEntryStatusError = new journalEntryError.InvalidStatus().errorKey;
const orderByError = new paginationError.InvalidOrderBy().errorKey;

const journalEntryOrderByValidation = z.enum(
  Object.values(EJournalEntrySortBy) as [
    UJournalEntrySortBy,
    ...UJournalEntrySortBy[],
  ],
  orderByError
);

export const getJournalEntriesQueryValidationSchema = z.object({
  ...omit(paginationDtoValidation.shape, ['orderBy']),
  accountId: z.uuid(accountIdError).optional(),
  counterpartyId: z.uuid(counterpartyIdError).optional(),
  orderBy: journalEntryOrderByValidation.optional(),
  status: z
    .enum(
      [EJournalEntryStatus.Posted, EJournalEntryStatus.Archived],
      journalEntryStatusError
    )
    .optional(),
});

/**
 * Journal entry source type validation schema
 */
export const journalEntrySourceTypeValidation = z.enum(
  Object.values(EJournalEntrySourceType) as [
    UJournalEntrySourceType,
    ...UJournalEntrySourceType[],
  ],
  sourceTypeError
);

export const journalEntrySideValidation = z.enum(
  Object.values(EJournalSide) as [UJournalSide, ...UJournalSide[]],
  journalSideError
);

export const journalEntryStatusValidation = z.enum(
  Object.values(EJournalEntryStatus) as [
    UJournalEntryStatus,
    ...UJournalEntryStatus[],
  ],
  journalEntryStatusError
);

export const journalLineReqValidation = z.object({
  accountId: z.uuid(accountIdError),
  counterparty: z
    .object({
      id: z.uuid(counterpartyIdError).optional(),
      name: counterpartyNameValidation,
      type: counterpartyTypeValidation.optional(),
    })
    .nullable(),
  amount: moneyDtoValidation,
  exchangeRate: exchangeRateDtoValidation.nullable(),
  description: z
    .string(descriptionError)
    .max(100, descriptionError)
    .min(1, descriptionError)
    .nullable(),
  sequenceOrder: z.number(sequenceOrderError).int().positive(),
});
