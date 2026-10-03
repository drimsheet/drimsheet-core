import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import {
  exchangeRateDtoValidation,
  exchangeRateJsonDtoValidation,
} from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';
import { moneyDtoValidation } from '@app/money/dtos/money/money.dto.validation';

export const openingBalanceDtoValidation = z.object({
  amount: moneyDtoValidation,
  exchangeRate: exchangeRateDtoValidation.nullable(),
  date: z
    .date(new journalEntryError.InvalidOpeningBalanceDate().errorKey)
    .refine((value) => value.getTime() <= Date.now(), {
      message: new journalEntryError.InvalidOpeningBalanceDate().errorKey,
    }),
});

export const openingBalanceCreationReqValidation = z.object({
  ...openingBalanceDtoValidation.shape,
  accountId: z.uuid(new ledgerAccountError.InvalidId().errorKey),
});

export const openingBalanceJsonDtoValidation =
  openingBalanceDtoValidation.extend({
    date: z.iso
      .datetime({
        offset: true,
        error: new journalEntryError.InvalidOpeningBalanceDate().errorKey,
      })
      .transform((value) => new Date(value))
      .pipe(openingBalanceDtoValidation.shape.date),
    exchangeRate: exchangeRateJsonDtoValidation.nullable(),
  });

export const openingBalanceCreationJsonReqValidation =
  openingBalanceCreationReqValidation.extend({
    date: openingBalanceJsonDtoValidation.shape.date,
    exchangeRate: openingBalanceJsonDtoValidation.shape.exchangeRate,
  });
