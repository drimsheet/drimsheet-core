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
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import ILedgerBalancesByCurrencyQueryRepo, {
  ILedgerCurrencyAccountBalance,
} from '@app/reporting/contracts/ledger-balances-by-currency.query.repo.contract';
import {
  IGetLedgerBalancesByCurrencyQuery,
  ILedgerBalancesByCurrencyDto,
} from '@app/reporting/dtos/ledger-balances-by-currency/ledger-balances-by-currency.dto';
import { getLedgerBalancesByCurrencyQueryValidationSchema } from '@app/reporting/dtos/ledger-balances-by-currency/ledger-balances-by-currency.dto.validation';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerBalancesByCurrencyQueryRepo: ILedgerBalancesByCurrencyQueryRepo;
}

export default function makeGetLedgerBalancesByCurrencyUsecase(
  deps: IDependencies
) {
  return async (
    type: IGetLedgerBalancesByCurrencyQuery['type']
  ): Promise<ILedgerBalancesByCurrencyDto> => {
    zodValidationRunner(getLedgerBalancesByCurrencyQueryValidationSchema, {
      type,
    });

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const functionalCurrency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const balances = await deps.ledgerBalancesByCurrencyQueryRepo.findAll(
      accountingEntity.id,
      type,
      functionalCurrency.code,
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
  accounts: ILedgerCurrencyAccountBalance[],
  functionalCurrency: ICurrency
): ILedgerBalancesByCurrencyDto {
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
