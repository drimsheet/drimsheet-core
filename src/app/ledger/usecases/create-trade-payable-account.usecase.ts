import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateTradePayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createTradePayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
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

export default function makeCreateTradePayableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateTradePayableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createTradePayableAccountValidation, payload);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };
    const allocationHeaderCode = LIABILITY_LEDGER_CODES.PAYABLES.HEADER;

    const controlAccount = await getControlAccountHelper({
      ledgerAccountRepo: deps.ledgerAccountRepo,
      controlAccountId: payload.controlAccountId,
      defaultControlAccountCode: LIABILITY_LEDGER_CODES.PAYABLES.TRADE,
      accountingEntityId: accountingEntity.id,
      repoOptions,
    });

    const auditedAccount =
      deps.payablesAccountService.createTradePayableSubAccount({
        name: payload.name,
        isControlAccount: payload.isControlAccount,
        controlAccount,
        createdBy: actor.id,
        accountingEntity,
        meta: payload.meta
          ? {
              counterpartyId: payload.meta.counterpartyId as TEntityId,
              invoiceId: payload.meta.invoiceId as TEntityId,
            }
          : null,
      });

    const [account, events, audit] = auditedAccount;
    const accountHistory = historyValue.make(audit, actor.id, correlationId);

    const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
      tx
    ) => {
      return deps.ledgerAccountPersistenceService.createAndAssignCode(
        { account, allocationHeaderCode, actorId: actor.id },
        accountingEntity.functionalCurrencyCode,
        { ...repoOptions, tx, history: [accountHistory] }
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
