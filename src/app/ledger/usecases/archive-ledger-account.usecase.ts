import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountArchiveService from '@domain/ledger/types/ledger-account-archive.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  archiveService: ILedgerAccountArchiveService;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeArchiveLedgerAccountUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const accountReference = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!accountReference) {
      throw new ledgerAccountError.AccountNotFound({ id });
    }
    const allocationHeaderCode =
      accountReference.materializedPath.split('.')[0];

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const lockedReadOptions = {
        ...transactionOptions,
        lock: ERepoLock.Update,
      };
      const allocationHeader = await deps.ledgerAccountRepo.findByCode(
        allocationHeaderCode,
        accountingEntity.id,
        lockedReadOptions
      );
      if (!allocationHeader) {
        throw new ledgerAccountError.AccountNotFound({
          id: accountReference.id,
        });
      }

      const account =
        allocationHeader.id === accountReference.id
          ? allocationHeader
          : await deps.ledgerAccountRepo.findById(
              id as TEntityId,
              accountingEntity.id,
              lockedReadOptions
            );
      if (!account) {
        throw new ledgerAccountError.AccountNotFound({ id });
      }

      const archivedAccounts = await deps.archiveService.archive(
        account,
        lockedReadOptions
      );

      // All account/history writes commit together; no accounting records are rewritten.
      for (const auditedAccount of archivedAccounts) {
        const [archivedAccount, , audit] = auditedAccount;
        const history = historyValue.make(audit, actor.id, correlationId);

        await deps.ledgerAccountRepo.update(archivedAccount, {
          ...transactionOptions,
          expectedVersion: archivedAccount.version - 1,
          history,
        });
      }

      await transaction.commit();

      const events = archivedAccounts.flatMap(([, v]) => v);

      await deps.eventBus.publish(
        eventValue.enrichAll(events, {
          correlationId,
          idempotencyKey,
        })
      );
    } catch (error) {
      return await transaction.handleError(error);
    } finally {
      await transaction.dispose();
    }
  };
}
