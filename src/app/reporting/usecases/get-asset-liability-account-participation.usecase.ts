import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IAssetLiabilityAccountParticipationQueryRepo, {
  IAssetLiabilityAccountBalance,
} from '@app/reporting/contracts/asset-liability-account-participation.query.repo.contract';
import {
  IAssetLiabilityAccountParticipationDto,
  IGetAssetLiabilityAccountParticipationQuery,
} from '@app/reporting/dtos/asset-liability-account-participation/asset-liability-account-participation.dto';
import { getAssetLiabilityAccountParticipationQueryValidationSchema } from '@app/reporting/dtos/asset-liability-account-participation/asset-liability-account-participation.dto.validation';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  assetLiabilityAccountParticipationQueryRepo: IAssetLiabilityAccountParticipationQueryRepo;
}

interface IAccountParticipation extends Omit<
  IAssetLiabilityAccountParticipationDto,
  'amount'
> {
  amount: IMoney;
}

export default function makeGetAssetLiabilityAccountParticipationUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetAssetLiabilityAccountParticipationQuery
  ): Promise<IPaginatedResponse<IAssetLiabilityAccountParticipationDto>> => {
    zodValidationRunner(
      getAssetLiabilityAccountParticipationQueryValidationSchema,
      query
    );

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );

    const balances =
      await deps.assetLiabilityAccountParticipationQueryRepo.findAll(
        accountingEntity.id,
        currency.code,
        { correlationId }
      );

    const { accounts, totals } = buildAccountsAndTotals(balances, currency);

    for (const account of accounts) {
      account.sharePercentage = moneyValue.getPercentage(
        account.amount,
        totals[account.type]
      );
    }

    return buildAssetLiabilityAccountParticipationResponse(accounts, query);
  };
}

/**
 * Builds posting-account rows and root totals directly from stored balances.
 * Rejects missing or out-of-range balances and counts each root only once.
 */
function buildAccountsAndTotals(
  balances: IAssetLiabilityAccountBalance[],
  currency: ICurrency
) {
  const totals = {
    asset: moneyValue.makeZeroAmount(currency),
    liability: moneyValue.makeZeroAmount(currency),
  };

  const accounts: IAccountParticipation[] = [];

  for (const balance of balances) {
    if (balance.functionalBalance === null) {
      throw new ledgerAppError.BalanceNotFound({
        accountId: balance.accountId,
      });
    }

    const amount = moneyValue.make(balance.functionalBalance, currency, true);
    reportingValidation.validateAmountLimit(amount);
    reportingValidation.validateSafeAmount(amount);

    // Roots include standalone posting accounts such as suspense. Descendant
    // balances are already propagated into root totals and must not be added.
    if (balance.controlAccountId === null) {
      totals[balance.type] = moneyValue.add(totals[balance.type], amount);
    }
    if (balance.isControlAccount) {
      continue;
    }

    accounts.push({
      accountId: balance.accountId,
      accountName: balance.accountName,
      code: balance.code,
      type: balance.type,
      subType: balance.subType,
      status: balance.status,
      amount,
      sharePercentage: null,
    });
  }

  for (const total of Object.values(totals)) {
    reportingValidation.validateAmountLimit(total);
    reportingValidation.validateSafeAmount(total);
  }

  return { accounts, totals };
}

/**
 * Filters and paginates calculated participation rows, then maps money to DTOs.
 * Preserves repository ordering and the shares calculated from full totals.
 */
function buildAssetLiabilityAccountParticipationResponse(
  accounts: IAccountParticipation[],
  query: IGetAssetLiabilityAccountParticipationQuery
): IPaginatedResponse<IAssetLiabilityAccountParticipationDto> {
  const search = query.search?.toLowerCase() ?? '';
  const filteredAccounts = accounts.filter((account) => {
    const matchesType = query.type === undefined || account.type === query.type;
    const matchesSearch =
      account.accountName.toLowerCase().includes(search) ||
      account.code.includes(search);
    return matchesType && matchesSearch;
  });
  const limit = paginationValue.getLimit(query.limit);
  const offset = paginationValue.getOffset(
    paginationValue.pageToOffset(query.page, limit)
  );

  return paginationValue.getPaginatedResponse(
    filteredAccounts.slice(offset, offset + limit).map((account) => ({
      accountId: account.accountId,
      accountName: account.accountName,
      code: account.code,
      type: account.type,
      subType: account.subType,
      status: account.status,
      amount: moneyMapper.toDto(account.amount),
      sharePercentage: account.sharePercentage,
    })),
    filteredAccounts.length,
    { limit, offset }
  );
}
