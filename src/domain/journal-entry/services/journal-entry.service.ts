import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Voids a journal and creates its reversal with eligible accounts and period. */
function makeVoid(deps: IDependencies): IJournalEntryService['void'] {
  return async (entry, actorId, repoOptions) => {
    const journalVoid = journalEntryEntity.void(entry, actorId);

    if (journalVoid.reversal === null) {
      return journalVoid;
    }

    const [reversal] = journalVoid.reversal;
    const accountIds = [
      ...new Set(reversal.lines.map((line) => line.accountId)),
    ];

    const accounts = await deps.ledgerAccountRepo.findAllByIds(
      accountIds,
      reversal.accountingEntityId,
      repoOptions
    );
    const foundAccountIds = new Set(accounts.map((account) => account.id));
    const missingAccountId = accountIds.find((id) => !foundAccountIds.has(id));

    if (missingAccountId !== undefined) {
      throw new journalEntryError.AccountNotFound({
        accountId: missingAccountId,
      });
    }

    journalEntryServiceValidation.validateArchivedAccounts(accounts);

    await deps.accountingPeriodService.validatePostingPeriod(
      reversal.accountingEntityId,
      reversal.effectiveDate,
      repoOptions
    );

    return journalVoid;
  };
}

export default function makeJournalEntryService(
  deps: IDependencies
): IJournalEntryService {
  return Object.freeze({ void: makeVoid(deps) });
}
