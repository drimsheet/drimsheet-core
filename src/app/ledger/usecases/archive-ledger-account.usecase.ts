/**
 * SUMMARY
 * Archives a non-root account in the selected accounting entity and, for a
 * control account, its descendants. Saves changed account states and audits
 * together, then publishes archival events. Preserves balances and journal
 * references. Root accounts are rejected; an already archived target requires
 * no account changes. Returns no value.
 *
 * WHEN TO USE
 * Use to retire an account or account subtree while retaining its financial
 * history. Use deletion only for an eligible account and its eligible
 * descendants.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/archive-ledger-account.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountService: ILedgerAccountService;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeArchiveLedgerAccountUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const lockedReadOptions = {
        ...transactionOptions,
        lock: ERepoLock.Update,
      };

      const account = await deps.ledgerAccountRepo.findById(
        id as TEntityId,
        accountingEntity.id,
        lockedReadOptions
      );
      if (!account) {
        throw new ledgerAccountError.AccountNotFound({ id });
      }

      const archivedAccounts = await deps.ledgerAccountService.archive(
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
    }
  };
}
