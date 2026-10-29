import { omit } from 'lodash';
import z from 'zod';

import dateError from '@shared/values/errors/date.error';
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
import { ledgerAccountTypeValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';
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

const invalidDateKey = new dateError.InvalidDate().errorKey;
const invalidDateRangeKey = new dateError.InvalidDates().errorKey;
const timestampFilterValidation = z.iso
  .datetime({
    offset: true,
    error: invalidDateKey,
  })
  .refine((date) => date >= '0001-01-01', invalidDateKey)
  .refine((date) => !/\.\d{4}/.test(date), invalidDateKey);
const calendarDateFilterValidation = z.iso
  .date(invalidDateKey)
  .refine((date) => date >= '0001-01-01', invalidDateKey);

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

export const getJournalEntriesQueryValidationSchema = z
  .strictObject({
    ...omit(paginationDtoValidation.shape, ['orderBy']),
    createdAtFrom: timestampFilterValidation.optional(),
    createdAtTo: timestampFilterValidation.optional(),
    effectiveDateFrom: calendarDateFilterValidation.optional(),
    effectiveDateTo: calendarDateFilterValidation.optional(),
    updatedAtFrom: timestampFilterValidation.optional(),
    updatedAtTo: timestampFilterValidation.optional(),
    currencyCode: currencyCodeValidation.optional(),
    accountType: ledgerAccountTypeValidation.optional(),
    sourceType: journalEntrySourceTypeValidation
      .exclude([EJournalEntrySourceType.Reversal], sourceTypeError)
      .optional(),
    accountId: z.uuid(accountIdError).optional(),
    counterpartyId: z.uuid(counterpartyIdError).optional(),
    orderBy: journalEntryOrderByValidation.optional(),
    status: z
      .enum(
        [EJournalEntryStatus.Posted, EJournalEntryStatus.Archived],
        journalEntryStatusError
      )
      .optional(),
  })
  .superRefine((query, ctx) => {
    const ranges = [
      {
        from: query.createdAtFrom,
        to: query.createdAtTo,
        field: 'createdAtTo',
      },
      {
        from: query.effectiveDateFrom,
        to: query.effectiveDateTo,
        field: 'effectiveDateTo',
      },
      {
        from: query.updatedAtFrom,
        to: query.updatedAtTo,
        field: 'updatedAtTo',
      },
    ];
    for (const range of ranges) {
      const isReversed =
        range.from !== undefined &&
        range.to !== undefined &&
        Date.parse(range.from) > Date.parse(range.to);
      if (isReversed) {
        ctx.addIssue({
          code: 'custom',
          path: [range.field],
          message: invalidDateRangeKey,
        });
      }
    }
  });

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
