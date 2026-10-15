import z from 'zod';

import appError from '@shared/values/errors/app.error';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';

import { ledgerAccountTypeValidation } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';

export const getChartOfAccountsQueryValidationSchema = z.object({
  class: ledgerAccountTypeValidation,
  search: paginationDtoValidation.shape.search,
  omitHeaderAccounts: z
    .boolean(new appError.UnprocessableEntity([]).errorKey)
    .optional(),
});
