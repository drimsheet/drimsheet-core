import z from 'zod';

import { ELedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ELedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';

import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';

const bucketKey = new reportingError.InvalidBucketDays().errorKey;
const typeKey = new reportingError.InvalidTypes().errorKey;
const subTypeKey = new reportingError.InvalidSubTypes().errorKey;
const behaviorKey = new reportingError.InvalidBehaviors().errorKey;
const accountKey = new reportingError.InvalidAccountId().errorKey;
const seriesSchema = dateRangeValidationSchema.extend({
  bucketDays: z.number(bucketKey).int(bucketKey).positive(bucketKey),
});

export const getBalancesByTypeQueryValidationSchema = seriesSchema.extend({
  types: z.array(z.enum(ELedgerType, typeKey), typeKey).min(1, typeKey),
});

export const getBalancesBySubTypeQueryValidationSchema = seriesSchema.extend({
  subTypes: z
    .array(z.enum(ELedgerAccountSubType, subTypeKey), subTypeKey)
    .min(1, subTypeKey),
});

export const getBalancesByBehaviorQueryValidationSchema = seriesSchema.extend({
  behaviors: z
    .array(z.enum(ELedgerAccountBehavior, behaviorKey), behaviorKey)
    .min(1, behaviorKey),
});

export const getBalancesByAccountQueryValidationSchema = seriesSchema.extend({
  accountIds: z.array(z.uuid(accountKey), accountKey).min(1, accountKey),
});
