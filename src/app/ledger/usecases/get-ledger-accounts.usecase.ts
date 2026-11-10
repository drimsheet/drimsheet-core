/**
 * SUMMARY
 * Lists accounts in the selected entity using filters, ordering, and
 * pagination, enriching each with balances. Defaults statuses to active when
 * omitted; an empty array leaves statuses unfiltered. Returns account rows and
 * pagination metadata; a result page may be empty.
 *
 * WHEN TO USE
 * Use for flat account browsing or selection. Supply statuses when draft or
 * archived accounts are needed.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountQueryRepo, {
  IFindAllLedgerAccountsOptions,
} from '@app/ledger/contracts/ledger-account.query.repo.contract';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { getLedgerAccountQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import loadLedgerAccountDtosWithBalancesHelper from '@app/ledger/usecases/helpers/load-ledger-account-dtos-with-balances.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountQueryRepo: ILedgerAccountQueryRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

export default function makeGetLedgerAccountsUsecase(deps: IDependencies) {
  return async (
    query: IGetLedgerAccountsQuery
  ): Promise<IPaginatedResponse<ILedgerAccountDto>> => {
    zodValidationRunner(getLedgerAccountQueryValidationSchema, query);
    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };
    const offset = paginationValue.pageToOffset(query.page, query.limit);
    const accountRepoOptions: IFindAllLedgerAccountsOptions = {
      ...query,
      statuses: query.statuses ?? [ELedgerAccountStatus.Active],
      offset,
      ...repoOptions,
    };

    const ledgerAccountsRes = await deps.ledgerAccountQueryRepo.findAll(
      accountingEntity.id,
      accountRepoOptions
    );

    const data = await loadLedgerAccountDtosWithBalancesHelper(
      deps.ledgerAccountBalanceRepo,
      ledgerAccountsRes.data,
      accountingEntity.id,
      repoOptions
    );

    return {
      data,
      meta: ledgerAccountsRes.meta,
    };
  };
}
