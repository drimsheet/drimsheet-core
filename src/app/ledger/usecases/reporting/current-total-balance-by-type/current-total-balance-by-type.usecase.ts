/**
 * SUMMARY
 * Sums current header balances for one account type in functional currency.
 * Stored balances are eventually consistent. Missing balances reject.
 *
 * WHEN TO USE
 * Use for a current total without a date range or currency conversion.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { ULedgerType } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  getCurrentTotalBalanceByTypeQueryValidationSchema,
  ICurrentTotalBalanceByTypeDto,
  IGetCurrentTotalBalanceByTypeQuery,
} from './dto';

export interface IGetCurrentTotalBalanceByTypeRepoQueryInput {
  accountingEntityId: TEntityId;
  type: ULedgerType;
  functionalCurrencyCode: UCurrencyCode;
}

export interface IGetCurrentTotalBalanceByTypeRepoQueryOutput {
  accountId: string;
  functionalAmount: bigint | null;
}

/**
 * Reads root accounts of the selected type, including root posting accounts,
 * in one snapshot. Includes all statuses; missing balances remain null.
 */
export type TGetCurrentTotalBalanceByTypeRepoQuery = (
  input: IGetCurrentTotalBalanceByTypeRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetCurrentTotalBalanceByTypeRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TGetCurrentTotalBalanceByTypeRepoQuery;
}

export default function makeGetCurrentTotalBalanceByTypeUsecase(
  deps: IDependencies
) {
  return async (
    type: IGetCurrentTotalBalanceByTypeQuery['type']
  ): Promise<ICurrentTotalBalanceByTypeDto> => {
    zodValidationRunner(getCurrentTotalBalanceByTypeQueryValidationSchema, {
      type,
    });
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const accounts = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        type,
        functionalCurrencyCode: currency.code,
      },
      { correlationId }
    );

    let total = moneyValue.makeZeroAmount(currency);
    for (const account of accounts) {
      if (account.functionalAmount === null) {
        throw new ledgerAppError.BalanceNotFound({
          accountId: account.accountId,
        });
      }
      const balance = moneyValue.make(account.functionalAmount, currency, true);
      reportingValidation.validateAmountLimit(balance);
      reportingValidation.validateSafeAmount(balance);
      total = moneyValue.add(total, balance);
    }
    reportingValidation.validateAmountLimit(total);
    reportingValidation.validateSafeAmount(total);
    return { totalFunctionalBalance: moneyMapper.toDto(total) };
  };
}
