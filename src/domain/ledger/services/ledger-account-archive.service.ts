import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountArchiveService from '@domain/ledger/types/ledger-account-archive.service.types';
import { TAuditedLedgerAccount } from '@domain/ledger/types/ledger.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Archives the supplied non-header account and its descendants, returning audited transitions. Never persists. */
function makeArchive(
  deps: IDependencies
): ILedgerAccountArchiveService['archive'] {
  return async (account, repoOptions) => {
    if (account.controlAccountId === null) {
      throw new ledgerAccountError.HeaderAccountNotArchivable({
        id: account.id,
      });
    }

    const [archivedAccount, targetEvents, targetAudit] =
      ledgerAccountEntity.archive(account);

    if (!targetAudit) {
      return [];
    }

    const archivedAccounts: TAuditedLedgerAccount[] = [
      [archivedAccount, targetEvents, targetAudit],
    ];

    if (account.isControlAccount) {
      const descendants = await deps.ledgerAccountRepo.findDescendants(
        account.accountingEntityId,
        account.materializedPath,
        repoOptions
      );
      for (const descendant of descendants) {
        const [archivedDescendant, descendantEvents, audit] =
          ledgerAccountEntity.archive(descendant);
        if (audit) {
          archivedAccounts.push([archivedDescendant, descendantEvents, audit]);
        }
      }
    }
    return archivedAccounts;
  };
}

export default function makeLedgerAccountArchiveService(
  deps: IDependencies
): ILedgerAccountArchiveService {
  return Object.freeze({ archive: makeArchive(deps) });
}
