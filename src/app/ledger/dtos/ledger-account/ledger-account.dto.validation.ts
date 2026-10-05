import { omit } from 'lodash';
import z from 'zod';

import appError from '@shared/values/errors/app.error';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerAccountSortBy,
  ULedgerAccountSortBy,
} from '@domain/ledger/repos/ledger-account.repo';
import {
  ELedgerAccountBehavior,
  ULedgerAccountBehavior,
} from '@domain/ledger/types/account-behaviors.tyypes';
import {
  ELedgerAccountSubType,
  ULedgerAccountSubType,
} from '@domain/ledger/types/ledger-aggregate.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  ULedgerType,
} from '@domain/ledger/types/ledger.types';

// =========== error keys start ===========
const invalidTypeKey = new ledgerAccountError.InvalidType().errorKey;
const invalidSubTypeKey = new ledgerAccountError.InvalidSubType().errorKey;
const invalidBehaviorKey = new ledgerAccountError.InvalidBehavior().errorKey;
const defaultErrorKey = new appError.UnprocessableEntity([]).errorKey;
// =========== error keys end ===========

export const ledgerAccountCreationStatusValidation = z.enum(
  [ELedgerAccountStatus.Active, ELedgerAccountStatus.Draft],
  new ledgerAccountError.InvalidStatus().errorKey
);

export const ledgerAccountTypeValidation = z.enum(
  Object.values(ELedgerType) as [ULedgerType, ...ULedgerType[]],
  invalidTypeKey
);

export const ledgerAccountOrderByValidationSchema = z.enum(
  Object.values(ELedgerAccountSortBy) as [
    ULedgerAccountSortBy,
    ...ULedgerAccountSortBy[],
  ],
  { message: invalidTypeKey }
);

export const ledgerAccountSubTypeValidation = z.enum(
  Object.values(ELedgerAccountSubType) as [
    ULedgerAccountSubType,
    ...ULedgerAccountSubType[],
  ],
  { message: invalidSubTypeKey }
);

export const ledgerAccountBehaviorValidation = z.enum(
  Object.values(ELedgerAccountBehavior) as [
    ULedgerAccountBehavior,
    ...ULedgerAccountBehavior[],
  ],
  { message: invalidBehaviorKey }
);

export const getLedgerAccountQueryValidationSchema = z.object({
  status: z
    .enum(
      Object.values(ELedgerAccountStatus),
      new ledgerAccountError.InvalidStatus().errorKey
    )
    .optional(),
  ...omit(paginationDtoValidation.shape, ['orderBy']),
  type: ledgerAccountTypeValidation.optional(),
  subType: ledgerAccountSubTypeValidation.optional(),
  behavior: ledgerAccountBehaviorValidation.optional(),
  isControlAccount: z.boolean(defaultErrorKey).optional(),
  orderBy: ledgerAccountOrderByValidationSchema.optional(),
});
