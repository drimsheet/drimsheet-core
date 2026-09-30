import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateStatutoryPayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createStatutoryPayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import getControlAccountHelper from '@app/ledger/usecases/helpers/get-control-account.helper';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  payablesAccountService: IPayablesAccountService;
}

export default function makeCreateStatutoryPayableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateStatutoryPayableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createStatutoryPayableAccountValidation, payload);
    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };
    const allocationHeaderCode = LIABILITY_LEDGER_CODES.PAYABLES.HEADER;
    const controlAccount = await getControlAccountHelper({
      ledgerAccountRepo: deps.ledgerAccountRepo,
      controlAccountId: payload.controlAccountId,
      defaultControlAccountCode: LIABILITY_LEDGER_CODES.PAYABLES.STATUTORY,
      accountingEntityId: accountingEntity.id,
      repoOptions,
    });
    const auditedAccount =
      deps.payablesAccountService.createStatutoryPayableSubAccount({
        name: payload.name,
        isControlAccount: payload.isControlAccount,
        controlAccount,
        createdBy: actor.id,
        accountingEntity,
        currency: currencyEntity.getByCode(payload.currencyCode),
        meta: payload.meta ?? null,
      });

    const [account, events, audit] = auditedAccount;
    const accountHistory = historyValue.make(audit, actor.id, correlationId);

    const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
      tx
    ) => {
      const persistencePayload = {
        account,
        allocationHeaderCode,
        actorId: actor.id,
      };
      const repoWriteOptions = {
        ...repoOptions,
        tx,
        history: [accountHistory],
      };

      return deps.ledgerAccountPersistenceService.createAndAssignCode(
        persistencePayload,
        accountingEntity.functionalCurrencyCode,
        repoWriteOptions
      );
    };

    const assignedAccount =
      await deps.repoService.runInTransaction(transactionFn);

    await deps.eventBus.publish(
      eventValue.enrichAll([...events, ...assignedAccount.events], repoOptions)
    );

    return ledgerAccountToDtoMapperHelper(
      assignedAccount.account,
      null,
      accountingEntity.functionalCurrencyCode
    );
  };
}
