import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IReceivablesAccountService } from '@domain/ledger/types/receivables-account.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateStatutoryReceivableAccountDto } from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import { createStatutoryReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';
import getControlAccountHelper from '@app/ledger/usecases/helpers/get-control-account.helper';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  receivablesAccountService: IReceivablesAccountService;
}

export default function makeCreateStatutoryReceivableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateStatutoryReceivableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createStatutoryReceivableAccountValidation, payload);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const allocationHeaderCode = ASSET_LEDGER_CODES.RECEIVABLES.HEADER;

    const controlAccount = await getControlAccountHelper({
      ledgerAccountRepo: deps.ledgerAccountRepo,
      controlAccountId: payload.controlAccountId,
      defaultControlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.STATUTORY,
      accountingEntityId: accountingEntity.id,
      repoOptions,
    });

    const auditedAccount =
      deps.receivablesAccountService.createStatutoryReceivableSubAccount({
        name: payload.name,
        isControlAccount: payload.isControlAccount,
        controlAccount,
        createdBy: actor.id,
        accountingEntity,
        currency: currencyEntity.getByCode(payload.currencyCode),
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
