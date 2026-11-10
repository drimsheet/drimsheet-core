/**
 * SUMMARY
 * Returns a balance-enriched account tree for the selected entity and requested
 * account class. Omitting headers promotes their children to the result roots.
 * Name search selects the first matching node on each branch and retains its
 * full subtree, including descendants whose names do not match.
 *
 * WHEN TO USE
 * Use to browse the chart as a hierarchy. Use get-ledger-accounts when a flat
 * paginated list is needed.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';
import {
  IChartOfAccountsNodeDto,
  IGetChartOfAccountsQuery,
} from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto';
import chartOfAccountsMapper from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.mapper';
import { getChartOfAccountsQueryValidationSchema } from '@app/ledger/dtos/chart-of-accounts/chart-of-accounts.dto.validation';
import loadLedgerAccountDtosWithBalancesHelper from '@app/ledger/usecases/helpers/load-ledger-account-dtos-with-balances.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountQueryRepo: ILedgerAccountQueryRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
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
    const accountDtos = await loadLedgerAccountDtosWithBalancesHelper(
      deps.ledgerAccountBalanceRepo,
      accounts,
      accountingEntity.id,
      repoOptions
    );

    return chartOfAccountsMapper.toDto(
      accountDtos,
      query.omitHeaderAccounts,
      query.search
    );
  };
}
