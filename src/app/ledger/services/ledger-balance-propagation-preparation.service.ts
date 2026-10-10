import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountBalanceAdjustmentService, {
  ILedgerAccountBalanceDelta,
} from '@domain/ledger/types/ledger-account-balance-adjustment.service.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';

import ILedgerBalancePropagationPreparationAppService, {
  IPreparedLedgerAccountBalanceAdjustment,
} from '@app/ledger/contracts/ledger-balance-propagation-preparation.service.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  journalEntryRepo: IJournalEntryRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountBalanceAdjustmentService: ILedgerAccountBalanceAdjustmentService;
}

interface IBalancePropagation {
  journalEntry: IJournalEntry;
  balanceDeltas: ILedgerAccountBalanceDelta[];
  ledgerAccountIds: TEntityId[];
}

/**
 * Resolves a posted journal's directly affected accounts and ancestors, then
 * calculates one aggregated delta per account in deterministic account-ID
 * order. Invalid or unavailable journals reject before further reads.
 */
async function prepareBalancePropagation(
  deps: IDependencies,
  journalEntryId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<IBalancePropagation> {
  const journalEntry = await deps.journalEntryRepo.findById(
    journalEntryId,
    repoOptions
  );

  if (!journalEntry) {
    throw new journalEntryError.InvalidJournalEntry({ journalEntryId });
  }

  journalEntryEntity.validateBalancePropagation(journalEntry);

  const directAccountIds = Array.from(
    new Set(journalEntry.lines.map((line) => line.accountId))
  );

  const directAccountsPage = await deps.ledgerAccountRepo.findAll(
    journalEntry.accountingEntityId,
    {
      ...repoOptions,
      ids: directAccountIds,
      limit: directAccountIds.length,
    }
  );

  const materializedPaths = ledgerAccountEntity.getMaterializedPaths(
    directAccountsPage.data
  );
  const accounts = await deps.ledgerAccountRepo.findAllByMaterializedPath(
    journalEntry.accountingEntityId,
    materializedPaths,
    repoOptions
  );

  const balanceDeltas = deps.ledgerAccountBalanceAdjustmentService.calculate(
    journalEntry,
    accounts
  );
  const orderedBalanceDeltas = [...balanceDeltas];
  orderedBalanceDeltas.sort((left, right) =>
    left.ledgerAccountId.localeCompare(right.ledgerAccountId)
  );

  const ledgerAccountIds = orderedBalanceDeltas.map(
    (balanceDelta) => balanceDelta.ledgerAccountId
  );

  return {
    journalEntry,
    balanceDeltas: orderedBalanceDeltas,
    ledgerAccountIds,
  };
}

/**
 * Applies calculated deltas to the supplied balance entities in memory and
 * pairs each prepared write with the version that was read. Missing required
 * balances reject before any adjustment can be persisted.
 */
function prepareBalanceAdjustments(
  propagation: IBalancePropagation,
  balances: ILedgerAccountBalance[]
): IPreparedLedgerAccountBalanceAdjustment[] {
  const { journalEntry, balanceDeltas, ledgerAccountIds } = propagation;
  const balancesByAccountId = new Map(
    balances.map((balance) => [balance.ledgerAccountId, balance])
  );

  if (balancesByAccountId.size !== ledgerAccountIds.length) {
    throw new ledgerAppError.BalanceNotFound();
  }

  const preparedAdjustments: IPreparedLedgerAccountBalanceAdjustment[] = [];

  for (const balanceDelta of balanceDeltas) {
    const existingBalance = balancesByAccountId.get(
      balanceDelta.ledgerAccountId
    );

    if (!existingBalance) {
      throw new ledgerAppError.BalanceNotFound();
    }

    const balanceAdjustment = ledgerAccountBalanceEntity.adjust(
      existingBalance,
      {
        ledgerAccountId: balanceDelta.ledgerAccountId,
        amount: balanceDelta.amount,
        functionalAmount: balanceDelta.functionalAmount,
        journalEntryId: journalEntry.id,
        createdBy: journalEntry.createdBy,
      }
    );

    preparedAdjustments.push({
      balanceAdjustment,
      expectedVersion: existingBalance.version,
    });
  }

  return preparedAdjustments;
}

/**
 * Builds the complete read-only balance-propagation preparation operation.
 * Repository and domain failures reject unchanged, and all reads complete
 * before the caller decides whether to persist the returned adjustments.
 */
function makePrepare(
  deps: IDependencies
): ILedgerBalancePropagationPreparationAppService['prepare'] {
  return async (journalEntryId, repoOptions) => {
    const propagation = await prepareBalancePropagation(
      deps,
      journalEntryId,
      repoOptions
    );
    const balances = await deps.ledgerAccountBalanceRepo.findAllByAccountIds(
      propagation.journalEntry.accountingEntityId,
      propagation.ledgerAccountIds,
      repoOptions
    );

    return prepareBalanceAdjustments(propagation, balances);
  };
}

export default function makeLedgerBalancePropagationPreparationAppService(
  deps: IDependencies
): ILedgerBalancePropagationPreparationAppService {
  return Object.freeze({ prepare: makePrepare(deps) });
}
