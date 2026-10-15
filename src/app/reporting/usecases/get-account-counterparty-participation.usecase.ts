import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import IAppContext from '@app/context/contracts/app-context.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IAccountCounterpartyParticipationQueryRepo, {
  IAccountCounterpartyParticipationAggregate,
} from '@app/reporting/contracts/account-counterparty-participation.query.repo.contract';
import {
  IAccountCounterpartyParticipationDto,
  IGetAccountCounterpartyParticipationQuery,
} from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto';
import accountCounterpartyParticipationMapper from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto.mapper';
import { getAccountCounterpartyParticipationQueryValidationSchema } from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';
import { IAccountCounterpartyParticipation } from '@app/reporting/types/account-counterparty-participation.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  accountCounterpartyParticipationQueryRepo: IAccountCounterpartyParticipationQueryRepo;
}

export default function makeGetAccountCounterpartyParticipationUsecase(
  deps: IDependencies
) {
  return async (
    accountId: string,
    query: IGetAccountCounterpartyParticipationQuery
  ): Promise<IPaginatedResponse<IAccountCounterpartyParticipationDto>> => {
    stringUtils.validateUUID(accountId, reportingError.InvalidAccountId);
    zodValidationRunner(
      getAccountCounterpartyParticipationQueryValidationSchema,
      query
    );
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };
    const account = await deps.ledgerAccountRepo.findById(
      accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) {
      throw new reportingError.AccountNotFound();
    }

    const balance = await deps.ledgerAccountBalanceRepo.findByAccountId(
      account.id,
      accountingEntity.id,
      repoOptions
    );
    if (!balance) {
      throw new ledgerAppError.BalanceNotFound({ accountId });
    }

    const aggregates =
      await deps.accountCounterpartyParticipationQueryRepo.aggregateByAccount(
        {
          accountId: account.id,
          accountingEntityId: accountingEntity.id,
          functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
        },
        repoOptions
      );
    const participants = buildAccountCounterpartyParticipation(
      aggregates,
      balance.amount,
      currencyEntity.getByCode(accountingEntity.functionalCurrencyCode)
    );

    const search = query.search?.toLowerCase() ?? '';
    const filteredParticipants = participants.filter((participant) => {
      const name =
        participant.counterparty?.name ??
        (participant.isSelf ? accountingEntity.name : '');
      return name.toLowerCase().includes(search);
    });
    const limit = paginationValue.getLimit(query.limit);
    const offset = paginationValue.getOffset(
      paginationValue.pageToOffset(query.page, limit)
    );

    return paginationValue.getPaginatedResponse(
      filteredParticipants
        .slice(offset, offset + limit)
        .map(accountCounterpartyParticipationMapper.toDto),
      filteredParticipants.length,
      { limit, offset }
    );
  };
}

/**
 * Nets each posting account's normal side, then combines counterparties across
 * descendants. Shares use the stored account balance, never the returned rows.
 * Keeps self transfers separate from other unattributed activity and preserves
 * the query's deterministic group order, including zero contributions.
 */
function buildAccountCounterpartyParticipation(
  aggregates: IAccountCounterpartyParticipationAggregate[],
  balance: IMoney,
  functionalCurrency: ICurrency
): IAccountCounterpartyParticipation[] {
  reportingValidation.validateAmountLimit(balance);
  reportingValidation.validateSafeAmount(balance);

  const participants = new Map<string, IAccountCounterpartyParticipation>();
  for (const aggregate of aggregates) {
    const debits = moneyValue.make(aggregate.debits, balance.currency, true);
    const credits = moneyValue.make(aggregate.credits, balance.currency, true);
    const functionalDebits = moneyValue.make(
      aggregate.functionalDebits,
      functionalCurrency,
      true
    );
    const functionalCredits = moneyValue.make(
      aggregate.functionalCredits,
      functionalCurrency,
      true
    );
    const isDebitNormal = aggregate.normalBalance === 'debit';
    const amount = isDebitNormal
      ? moneyValue.subtract(debits, credits)
      : moneyValue.subtract(credits, debits);
    const functionalAmount = isDebitNormal
      ? moneyValue.subtract(functionalDebits, functionalCredits)
      : moneyValue.subtract(functionalCredits, functionalDebits);
    const key =
      aggregate.counterparty?.id ??
      (aggregate.isSelf ? 'self' : 'unattributed');
    const existing = participants.get(key);

    participants.set(key, {
      counterparty: aggregate.counterparty,
      isSelf: aggregate.isSelf,
      amount: existing ? moneyValue.add(existing.amount, amount) : amount,
      functionalAmount: existing
        ? moneyValue.add(existing.functionalAmount, functionalAmount)
        : functionalAmount,
      totalShare: null,
    });
  }

  for (const participant of participants.values()) {
    for (const money of [participant.amount, participant.functionalAmount]) {
      reportingValidation.validateAmountLimit(money);
      reportingValidation.validateSafeAmount(money);
    }
    participant.totalShare = moneyValue.getPercentage(
      participant.amount,
      balance
    );
  }

  return [...participants.values()];
}
