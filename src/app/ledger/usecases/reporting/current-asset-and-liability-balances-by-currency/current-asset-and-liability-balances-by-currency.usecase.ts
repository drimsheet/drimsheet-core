/**
 * SUMMARY
 * Groups signed posting-account balances for the requested ledger type in the
 * selected entity by denomination. Returns each currency balance, its recorded
 * functional balance, and the combined functional total, in minor units and
 * sorted by currency code. Uses stored functional values rather than converting
 * at current exchange rates. Missing balances and out-of-range amounts reject.
 *
 * WHEN TO USE
 * Use to inspect the denomination breakdown of a ledger type and its total in
 * the entity's functional currency.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema,
  ICurrentAssetAndLiabilityBalancesByCurrencyDto,
  IGetCurrentAssetAndLiabilityBalancesByCurrencyQuery,
} from './dto';

export interface IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryOutput {
  accountId: string;
  currencyCode: string;
  amount: bigint | null;
  functionalAmount: bigint | null;
}

export interface IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryInput {
  accountingEntityId: TEntityId;
  type: 'asset' | 'liability';
  functionalCurrencyCode: UCurrencyCode;
}

/**
 * Reads each posting account once for the entity and requested class in one
 * snapshot. Includes all statuses, suspense and zero balances. Accounts without
 * a fixed currency use functional currency. Missing balances remain null.
 * Stored balances are eventually consistent; journals and rollups are not read.
 */
export type TGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery = (
  input: IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQuery;
}

export default function makeGetCurrentAssetAndLiabilityBalancesByCurrencyUsecase(
  deps: IDependencies
) {
  return async (
    type: IGetCurrentAssetAndLiabilityBalancesByCurrencyQuery['type']
  ): Promise<ICurrentAssetAndLiabilityBalancesByCurrencyDto> => {
    zodValidationRunner(
      getCurrentAssetAndLiabilityBalancesByCurrencyQueryValidationSchema,
      {
        type,
      }
    );

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const functionalCurrency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const balances = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        type: type,
        functionalCurrencyCode: functionalCurrency.code,
      },
      { correlationId }
    );

    return buildCurrencyBalances(balances, functionalCurrency);
  };
}

/**
 * Groups signed posting balances by denomination using recorded functional
 * values and returns minor-unit DTOs. Rejects missing balances and checks rows,
 * groups and the final total.
 */
function buildCurrencyBalances(
  accounts: IGetCurrentAssetAndLiabilityBalancesByCurrencyRepoQueryOutput[],
  functionalCurrency: ICurrency
): ICurrentAssetAndLiabilityBalancesByCurrencyDto {
  const groups = new Map<
    string,
    { balance: IMoney; functionalBalance: IMoney }
  >();

  for (const account of accounts) {
    const amount = account.amount;
    const functionalAmount = account.functionalAmount;
    const isMissingBalance = amount === null || functionalAmount === null;
    if (isMissingBalance) {
      throw new ledgerAppError.BalanceNotFound({
        accountId: account.accountId,
      });
    }

    const currency = currencyEntity.getByCode(account.currencyCode);
    const balance = moneyValue.make(amount, currency, true);
    const functionalBalance = moneyValue.make(
      functionalAmount,
      functionalCurrency,
      true
    );
    reportingValidation.validateAmountLimit(balance);
    reportingValidation.validateSafeAmount(balance);
    reportingValidation.validateAmountLimit(functionalBalance);
    reportingValidation.validateSafeAmount(functionalBalance);

    const group = groups.get(currency.code);
    groups.set(currency.code, {
      balance: group ? moneyValue.add(group.balance, balance) : balance,
      functionalBalance: group
        ? moneyValue.add(group.functionalBalance, functionalBalance)
        : functionalBalance,
    });
  }

  const balancesByCurrency = [...groups.values()].sort((left, right) =>
    left.balance.currency.code.localeCompare(right.balance.currency.code)
  );
  let totalFunctionalBalance = moneyValue.makeZeroAmount(functionalCurrency);

  for (const group of balancesByCurrency) {
    reportingValidation.validateAmountLimit(group.balance);
    reportingValidation.validateSafeAmount(group.balance);
    reportingValidation.validateAmountLimit(group.functionalBalance);
    reportingValidation.validateSafeAmount(group.functionalBalance);
    totalFunctionalBalance = moneyValue.add(
      totalFunctionalBalance,
      group.functionalBalance
    );
  }

  reportingValidation.validateAmountLimit(totalFunctionalBalance);
  reportingValidation.validateSafeAmount(totalFunctionalBalance);

  return {
    totalFunctionalBalance: moneyMapper.toDto(totalFunctionalBalance),
    balancesByCurrency: balancesByCurrency.map((group) => ({
      balance: moneyMapper.toDto(group.balance),
      functionalBalance: moneyMapper.toDto(group.functionalBalance),
    })),
  };
}
