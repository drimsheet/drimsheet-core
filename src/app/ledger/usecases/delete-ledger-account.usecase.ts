import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountService: ILedgerAccountService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  repoService: IRepoService;
}

export default function makeDeleteLedgerAccountUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { ...repoOptions, tx: transaction.context };
      const lockedReadOptions = { ...writeOptions, lock: ERepoLock.Update };

      // Hold account locks through journal validation and deletion so new journal
      // references cannot be removed by the account FK cascade (LED-LA-009).
      const account = await deps.ledgerAccountRepo.findById(
        id as TEntityId,
        accountingEntity.id,
        lockedReadOptions
      );
      if (!account) {
        throw new ledgerAccountError.AccountNotFound({ id });
      }
      const removal = await deps.ledgerAccountService.delete(
        account,
        lockedReadOptions
      );

      // Persistence: version checks protect against journals posted or changed
      // after preparation; any failure rolls back all journal and account deletions.
      for (const entry of removal.journalEntries) {
        await deps.journalEntryPersistenceAppService.delete(
          {
            journalEntryId: entry.id,
            expectedVersion: entry.version,
          },
          writeOptions
        );
      }

      for (const candidate of removal.accounts) {
        await deps.ledgerAccountRepo.delete(candidate.id, {
          ...writeOptions,
          expectedVersion: candidate.version,
        });
      }

      return await transaction.commit();
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
