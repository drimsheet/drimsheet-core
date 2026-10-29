/**
 * SUMMARY
 * Creates an asset or liability suspense account in the selected entity and
 * requested currency. Enforces suspense-account creation rules and allocates
 * its account code. Saves the account, audit history, and initial balance
 * together, then publishes events and returns the account.
 *
 * WHEN TO USE
 * Use when activity needs an asset or liability suspense classification pending
 * its final allocation.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { ISuspenseAccountService } from '@domain/ledger/types/suspense-account.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  repoService: IRepoService;
  accountingEntityRepo: IAccountingEntityRepo;
  suspenseAccountService: ISuspenseAccountService;
  ledgerAccountPersistenceAppService: ILedgerAccountPersistenceAppService;
}

type TUsecaseTransactionFn = TRepoTransactionFn<{
  account: ILedgerAccount;
  events: IEvent<ILedgerAccount>[];
}>;

export default function makeCreateSuspenseAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateSuspenseAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createSuspenseAccountValidation, payload);
    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(payload.currencyCode);
    const repoOptions = { correlationId };
    const create =
      payload.type === 'asset'
        ? deps.suspenseAccountService.createAssetSuspense
        : deps.suspenseAccountService.createLiabilitySuspense;

    const transactionFn: TUsecaseTransactionFn = async (tx) => {
      // Lock before invariant reads: first creation has no suspense row to lock.
      // Read-committed waiters must see the preceding account before choosing a code.
      const transactionOptions = { ...repoOptions, tx };
      const lockedEntity = await deps.accountingEntityRepo.findById(
        accountingEntity.id,
        { ...transactionOptions, lock: ERepoLock.Update }
      );
      if (!lockedEntity) {
        throw new accountingAppError.ActiveEntityNotFound();
      }

      // Prepare the final account under the lock, across all currencies of this entity.
      const auditedAccount = await create(
        {
          name: payload.name,
          createdBy: actor.id,
          accountingEntityId: accountingEntity.id,
          currency,
        },
        transactionOptions
      );
      const [account, events, audit] = auditedAccount;
      const accountHistory = historyValue.make(audit, actor.id, correlationId);

      // Persist the prepared account/history/zero balance in the same transaction.
      await deps.ledgerAccountPersistenceAppService.create(
        account,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [accountHistory] }
      );
      return { account, events };
    };

    const committed = await deps.repoService.runInTransaction(transactionFn);

    await deps.eventBus.publish(
      eventValue.enrichAll<ILedgerAccount>(committed.events, repoOptions)
    );
    return ledgerAccountToDtoMapperHelper(
      committed.account,
      null,
      accountingEntity.functionalCurrencyCode
    );
  };
}
