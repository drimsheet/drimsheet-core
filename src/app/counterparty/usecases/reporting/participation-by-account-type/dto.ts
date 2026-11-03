import z from 'zod';

import { getFiscalYearParamsValidationSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';
import { IDateRangeDto } from '@app/ledger/usecases/reporting/shared/date-range';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface IGetCounterpartyAccountTypeParticipationQuery {
  fiscalYearId: string;
}

export interface ICounterpartyAccountTypeParticipationDto {
  counterpartyId: string;
  fiscalYearId: string;
  /** Full fiscal year, with inclusive effective-date boundaries. */
  period: IDateRangeDto;
  /** Credits minus debits, in the entity's functional currency. */
  revenue: IMoneyDto;
  /** Debits minus credits, in the entity's functional currency. */
  expense: IMoneyDto;
}

export const getCounterpartyAccountTypeParticipationQueryValidationSchema =
  z.object({
    fiscalYearId: getFiscalYearParamsValidationSchema.shape.id,
  });
