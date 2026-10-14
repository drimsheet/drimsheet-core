import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import openingBalanceActivationPreparationHelper from '@app/journal-entry/usecases/helpers/opening-balance-activation-preparation.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { ICashAccountActivationDto } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { cashAccountActivationDtoValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  cashAccountService: ICashAccountService;
  repoService: IRepoService;
  eventBus: IEventBus;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  journalEntryService: IJournalEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
}

export default function makeActivateCashAccountUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: ICashAccountActivationDto
  ): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(cashAccountActivationDtoValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id });
    }
    const [activatedAccount, accountEvents, accountAudit] =
      await deps.cashAccountService.activate(account, repoOptions);

    const history = historyValue.make(accountAudit, actor.id, correlationId);

    const openingBalances = payload.activateOpeningBalance
      ? await deps.journalEntryQueryRepo.findAll(
          activatedAccount.accountingEntityId,
          {
            ...repoOptions,
            accountId: activatedAccount.id,
            sourceType: EJournalEntrySourceType.OpeningBalance,
            status: EJournalEntryStatus.Draft,
            limit: 1,
          }
        )
      : null;
    const originalEntry = openingBalances?.data[0];

    const openingBalancePosting = originalEntry
      ? await openingBalanceActivationPreparationHelper(
          deps,
          { entry: originalEntry, account: activatedAccount, actor: actor.id },
          repoOptions
        )
      : null;

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      await deps.ledgerAccountRepo.update(activatedAccount, {
        ...transactionOptions,
        expectedVersion: account.version,
        history,
      });

      if (openingBalancePosting) {
        await deps.journalEntryPersistenceAppService.rectify(
          openingBalancePosting.persistence,
          transactionOptions
        );

        if (openingBalancePosting.fxAcquisition) {
          await deps.fxCostBasisPersistenceAppService.persistAcquisition(
            openingBalancePosting.fxAcquisition.records,
            transactionOptions
          );
        }

        await deps.outboxAppService.createBalancePropagation(
          openingBalancePosting.entry.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events = [
        ...accountEvents,
        ...(openingBalancePosting?.events ?? []),
        ...(openingBalancePosting?.fxAcquisition?.events ?? []),
      ];

      await deps.eventBus.publish(
        eventValue.enrichAll(events, {
          correlationId,
          idempotencyKey,
        })
      );

      if (openingBalancePosting) {
        await deps.ledgerBalanceAdjustmentQueue.add({
          journalEntryId: openingBalancePosting.entry.id,
          correlationId,
        });
      }
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
