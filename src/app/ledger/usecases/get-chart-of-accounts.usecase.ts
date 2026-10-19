import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';
import {
  IChartOfAccountsNodeDto,
  IGetChartOfAccountsQuery,
} from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto';
import chartOfAccountsMapper from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.mapper';
import { getChartOfAccountsQueryValidationSchema } from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountQueryRepo: ILedgerAccountQueryRepo;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
}

export default function makeGetChartOfAccountsUsecase(deps: IDependencies) {
  return async (
    query: IGetChartOfAccountsQuery
  ): Promise<IChartOfAccountsNodeDto[]> => {
    zodValidationRunner(getChartOfAccountsQueryValidationSchema, query);
    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const accounts = await deps.ledgerAccountQueryRepo.findChartOfAccounts(
      accountingEntity.id,
      query.class,
      repoOptions
    );
    const accountDtos = await deps.balanceEnrichmentAppService.enrich(
      accounts,
      accountingEntity,
      repoOptions
    );

    return chartOfAccountsMapper.toDto(
      accountDtos,
      query.omitHeaderAccounts,
      query.search
    );
  };
}
