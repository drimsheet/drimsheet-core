import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import openingBalanceEntryRule from '@domain/journal-entry/rules/opening-balance-entry.rule';
import paymentEntryRule from '@domain/journal-entry/rules/payment-entry.rule';
import receiptEntryRule from '@domain/journal-entry/rules/receipt-entry.rule';
import transferEntryRule from '@domain/journal-entry/rules/transfer-entry.rule';
import { IJournalEntryRule } from '@domain/journal-entry/types/entry.rules.types';
import {
  EJournalEntrySourceType,
  UJournalEntrySourceType,
} from '@domain/journal-entry/types/journal-entry.types';
import ILedgerAccountRepo, {
  IFindAllLedgerAccountsOptions,
} from '@domain/ledger/repos/ledger-account.repo';
import {
  ELedgerAccountSubType,
  ULedgerAccountSubType,
} from '@domain/ledger/types/ledger-aggregate.types';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { IGetPermittedPostingAccountsQuery } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto';
import { getPermittedPostingAccountsQueryValidationSchema } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto.validation';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  balanceEnrichmentAppService: ILedgerAccountBalanceEnrichmentAppService;
}

const journalEntryRules: Partial<
  Record<UJournalEntrySourceType, IJournalEntryRule>
> = {
  [EJournalEntrySourceType.OpeningBalance]: openingBalanceEntryRule,
  [EJournalEntrySourceType.Payment]: paymentEntryRule,
  [EJournalEntrySourceType.Receipt]: receiptEntryRule,
  [EJournalEntrySourceType.Transfer]: transferEntryRule,
};

function getPermittedValues<T>(restriction: Set<T> | '*') {
  return restriction === '*' ? undefined : Array.from(restriction);
}

function filterSuspense(options?: ULedgerAccountSubType[]) {
  const allOptions = options || Object.values(ELedgerAccountSubType);
  return allOptions.filter((v) => v !== ELedgerAccountSubType.Suspense);
}

export default function makeGetPermittedPostingAccountsUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetPermittedPostingAccountsQuery
  ): Promise<IPaginatedResponse<ILedgerAccountDto>> => {
    zodValidationRunner(
      getPermittedPostingAccountsQueryValidationSchema,
      query
    );
    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const offset = paginationValue.pageToOffset(query.page, query.limit);
    const rule = journalEntryRules[query.sourceType];

    if (!rule) {
      return paginationValue.getPaginatedResponse([], 0, {
        limit: query.limit,
        offset,
      });
    }

    const permits = rule[query.side];

    const currencyCodes = query.currencyCode
      ? [currencyEntity.getByCode(query.currencyCode).code, null]
      : undefined;

    const repoOptions = { correlationId };

    const types = getPermittedValues(permits.permittedTypes);
    const subTypes = getPermittedValues(permits.permittedSubTypes);
    const behaviors = getPermittedValues(permits.permittedBehaviors);

    const accountRepoOptions: IFindAllLedgerAccountsOptions = {
      statuses: [ELedgerAccountStatus.Active, ELedgerAccountStatus.Draft],
      types,
      subTypes: query.filterSuspense ? filterSuspense(subTypes) : subTypes,
      behaviors,
      currencyCodes,
      isControlAccount: false,
      limit: query.limit,
      offset,
      ...repoOptions,
    };

    const ledgerAccountsResponse = await deps.ledgerAccountRepo.findAll(
      accountingEntity.id,
      accountRepoOptions
    );

    const data = await deps.balanceEnrichmentAppService.enrich(
      ledgerAccountsResponse.data,
      accountingEntity,
      repoOptions
    );

    return {
      data,
      meta: ledgerAccountsResponse.meta,
    };
  };
}
