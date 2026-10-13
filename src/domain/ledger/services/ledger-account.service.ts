import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import controlAccountChildStatusValidation from '@domain/ledger/services/validations/control-account-child-status.validation';
import ILedgerAccountService, {
  ELedgerAccountCurrencyUpdateReason,
  ELedgerAccountDeletionReason,
} from '@domain/ledger/types/ledger-account.service.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryRepo: IJournalEntryRepo;
}

/** Validates account currency eligibility under caller-owned family/target locks. Never writes. */
function makeValidateCurrencyChange(
  deps: IDependencies
): ILedgerAccountService['validateCurrencyChange'] {
  return async (account, currency, repoOptions) => {
    if (currency === undefined) {
      return;
    }

    if (currency.code === account.currency?.code) {
      return;
    }

    if (!repoOptions.tx) {
      throw new ledgerAccountError.CurrencyChangeTransactionRequired();
    }

    const hasJournalEntries = await deps.journalEntryRepo.existsByAccountId(
      account.id,
      account.accountingEntityId,
      repoOptions
    );
    if (hasJournalEntries) {
      throw new ledgerAccountError.CurrencyChangeHasJournalEntries({
        id: account.id,
      });
    }

    if (!account.controlAccountId) {
      throw new ledgerAccountError.InvalidControlAccountId();
    }

    const parent = await deps.ledgerAccountRepo.findById(
      account.controlAccountId,
      account.accountingEntityId,
      repoOptions
    );
    if (!parent) {
      throw new ledgerAccountError.ControlAccountNotFound();
    }

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount: parent,
      subAccountCurrency: currency,
    });

    if (account.isControlAccount) {
      const descendants = await deps.ledgerAccountRepo.findDescendants(
        account.accountingEntityId,
        account.materializedPath,
        repoOptions
      );
      for (const descendant of descendants) {
        ledgerAccountCurrencyInvarianceRule.validate({
          controlAccount: {
            id: account.id,
            code: account.code,
            isControlAccount: account.isControlAccount,
            controlAccountId: account.controlAccountId,
            currency,
          },
          subAccountCurrency: descendant.currency,
        });
      }
    }
  };
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
    if (!repoOptions.tx) {
      throw new ledgerAccountError.CodeAllocationTransactionRequired();
    }

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

/** Checks currency update eligibility, skipping posting reads for non-assets. Never persists. */
function makeCanUpdateCurrency(
  deps: IDependencies
): ILedgerAccountService['canUpdateCurrency'] {
  return async (account, repoOptions) => {
    if (account.type !== ELedgerType.Asset) {
      return {
        canUpdateCurrency: false,
        reason: ELedgerAccountCurrencyUpdateReason.NotAssetAccount,
      };
    }

    const hasPostedJournalEntries =
      await deps.journalEntryRepo.existsPostedByAccountId(
        account.id,
        account.accountingEntityId,
        repoOptions
      );

    if (hasPostedJournalEntries) {
      return {
        canUpdateCurrency: false,
        reason: ELedgerAccountCurrencyUpdateReason.HasPostedJournalEntries,
      };
    }

    return { canUpdateCurrency: true };
  };
}

/** Checks account deletion eligibility, skipping reference reads for headers and drafts. Never persists. */
function makeCanDelete(
  deps: IDependencies
): ILedgerAccountService['canDelete'] {
  return async (account, repoOptions) => {
    if (account.controlAccountId === null) {
      return {
        canDelete: false,
        reason: ELedgerAccountDeletionReason.HeaderAccount,
      };
    }

    if (account.status === ELedgerAccountStatus.Draft) {
      return { canDelete: true };
    }

    const hasJournalEntries = await deps.journalEntryRepo.existsByAccountId(
      account.id,
      account.accountingEntityId,
      repoOptions
    );

    if (hasJournalEntries) {
      return {
        canDelete: false,
        reason: ELedgerAccountDeletionReason.HasJournalEntries,
      };
    }

    return { canDelete: true };
  };
}

/** Enforces eligibility for the complete subtree and preserves all accepted financial activity. */
function makeDelete(deps: IDependencies): ILedgerAccountService['delete'] {
  const canDelete = makeCanDelete(deps);

  const deletionReasonErrorMap = {
    [ELedgerAccountDeletionReason.HeaderAccount]:
      ledgerAccountError.HeaderAccountNotDeletable,
    [ELedgerAccountDeletionReason.HasJournalEntries]:
      ledgerAccountError.NonDraftAccountDeletion,
  };

  return async (account, repoOptions) => {
    const eligibility = await canDelete(account, repoOptions);
    if (eligibility.canDelete === false) {
      throw new deletionReasonErrorMap[eligibility.reason]({ id: account.id });
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
      const descendantEligibility = await canDelete(candidate, repoOptions);
      if (descendantEligibility.canDelete === false) {
        throw new deletionReasonErrorMap[descendantEligibility.reason]({
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
    canDelete: makeCanDelete(deps),
    canUpdateCurrency: makeCanUpdateCurrency(deps),
    validateCurrencyChange: makeValidateCurrencyChange(deps),
    delete: makeDelete(deps),
    getNextCode: makeGetNextCode(deps),
  });
}
