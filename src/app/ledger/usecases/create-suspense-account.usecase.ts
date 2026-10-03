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
import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  accountingEntityRepo: IAccountingEntityRepo;
  suspenseAccountService: ISuspenseAccountService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
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
      if (!lockedEntity) throw new accountingAppError.ActiveEntityNotFound();

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
      await deps.ledgerAccountPersistenceService.create(
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
