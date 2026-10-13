import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import controlAccountChildStatusValidation from '@domain/ledger/services/validations/control-account-child-status.validation';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
import {
  ELedgerAccountStatus,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryRepo: IJournalEntryRepo;
}

/** Archives the supplied non-header account and its descendants, returning audited transitions. Never persists. */
function makeArchive(deps: IDependencies): ILedgerAccountService['archive'] {
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

    const controlAccount = await deps.ledgerAccountRepo.findById(
      account.controlAccountId,
      account.accountingEntityId,
      repoOptions
    );
    if (!controlAccount) {
      throw new ledgerAccountError.ControlAccountIdNotFound({
        id: account.controlAccountId,
      });
    }
    controlAccountChildStatusValidation.validate(
      controlAccount.status,
      archivedAccount.status
    );

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

/** Selects the next family code after the caller locks and validates the allocation header. */
function makeGetNextCode(
  deps: IDependencies
): ILedgerAccountService['getNextCode'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    // A separate Read Committed statement sees the preceding lock holder's insert.
    const latest = await deps.ledgerAccountRepo.findLatestBySubType(
      payload.accountingEntityId,
      payload.type,
      payload.subType,
      repoOptions
    );
    return getNextSubledgerAccountCode(
      payload.allocationHeaderCode.slice(0, 3),
      latest?.code ?? payload.allocationHeaderCode
    );
  };
}

/** Enforces draft-subtree removal and preservation of all accepted financial activity. */
function makeDelete(deps: IDependencies): ILedgerAccountService['delete'] {
  return async (account, repoOptions) => {
    if (account.controlAccountId === null) {
      throw new ledgerAccountError.HeaderAccountNotDeletable({
        id: account.id,
      });
    }

    if (account.status !== ELedgerAccountStatus.Draft) {
      throw new ledgerAccountError.NonDraftAccountDeletion({ id: account.id });
    }

    const descendants = account.isControlAccount
      ? await deps.ledgerAccountRepo.findDescendants(
          account.accountingEntityId,
          account.materializedPath,
          repoOptions
        )
      : [];

    const accounts = [account, ...descendants];

    for (const candidate of descendants) {
      if (candidate.status !== ELedgerAccountStatus.Draft) {
        throw new ledgerAccountError.NonDraftAccountDeletion({
          id: candidate.id,
        });
      }
    }

    const journalEntries = await deps.journalEntryRepo.findAllByAccountIds(
      accounts.map((candidate) => candidate.id),
      account.accountingEntityId,
      repoOptions
    );

    for (const entry of journalEntries) {
      const isInvalidDraftJournal =
        entry.postedAt !== null ||
        entry.status !== EJournalEntryStatus.Draft ||
        entry.sourceType === EJournalEntrySourceType.Reversal;
      if (isInvalidDraftJournal) {
        throw new ledgerAccountError.InvalidDraftAccountJournalEntry({
          id: account.id,
          journalEntryId: entry.id,
        });
      }
    }

    // Descendant reads are ordered by materialized path, so reversing places children first.
    accounts.reverse();
    return { accounts, journalEntries };
  };
}

export default function makeLedgerAccountService(
  deps: IDependencies
): ILedgerAccountService {
  return Object.freeze({
    archive: makeArchive(deps),
    delete: makeDelete(deps),
    getNextCode: makeGetNextCode(deps),
  });
}
