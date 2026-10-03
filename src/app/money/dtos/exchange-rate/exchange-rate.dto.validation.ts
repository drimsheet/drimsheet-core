import { omit } from 'lodash';
import z from 'zod';

import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';

import exchangeRateError from '@domain/money/errors/exchange-rate.error';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';

import { currencyCodeValidation } from '@app/money/dtos/currency/currency.dto.validation';

export const currencyPairValidation = z
  .string()
  .regex(/^[A-Z]{3}\/[A-Z]{3}$/, new exchangeRateError.InvalidPair().errorKey);

export const exchangeRateDtoValidation = z.object({
  baseCurrencyCode: currencyCodeValidation,
  targetCurrencyCode: currencyCodeValidation,
  rate: z
    .number(new exchangeRateError.InvalidRate().errorKey)
    .positive(new exchangeRateError.InvalidRate().errorKey),
  type: z.enum(EExchangeRateType),
  asOf: z.coerce.date(new exchangeRateError.InvalidDate().errorKey),
  source: z
    .string()
    .min(2, new exchangeRateError.InvalidSource().errorKey)
    .max(100, new exchangeRateError.InvalidSource().errorKey),
});

export const exchangeRateIngestionDtoValidation = z.object({
  correlationId: z.uuid(),
  exchangeRates: z.array(exchangeRateDtoValidation),
});

export const getExchangeRatesQueryValidationSchema = z.object({
  ...omit(paginationDtoValidation.shape, ['search', 'sortDirection']),
  currencyPair: currencyPairValidation,
  type: z.enum(EExchangeRateType).optional(),
  asOf: exchangeRateDtoValidation.shape.asOf.optional(),
});

export const exchangeRateJsonDtoValidation =
  exchangeRateDtoValidation.safeExtend({
    asOf: z.iso
      .datetime({
        offset: true,
        error: new exchangeRateError.InvalidDate().errorKey,
      })
      .transform((value) => new Date(value)),
  });

export const getExchangeRatesJsonQueryValidationSchema =
  getExchangeRatesQueryValidationSchema.safeExtend({
    asOf: exchangeRateJsonDtoValidation.shape.asOf.optional(),
  });
