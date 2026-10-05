import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import ILedgerAccountRepo, {
  IFindAllLedgerAccountsOptions,
} from '@domain/ledger/repos/ledger-account.repo';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountBalanceEnrichmentService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { getLedgerAccountQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  balanceEnrichmentService: ILedgerAccountBalanceEnrichmentService;
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
      status: query.status ?? ELedgerAccountStatus.Active,
      offset,
      ...repoOptions,
    };

    const ledgerAccountsRes = await deps.ledgerAccountRepo.findAll(
      accountingEntity.id,
      accountRepoOptions
    );

    const data = await deps.balanceEnrichmentService.enrich(
      ledgerAccountsRes.data,
      accountingEntity,
      repoOptions
    );

    return {
      data,
      meta: ledgerAccountsRes.meta,
    };
  };
}
