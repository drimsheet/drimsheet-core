/**
 * SUMMARY
 * Applies a journal's effects to derived balances for affected accounts and
 * their ancestors. Saves prepared adjustments in one transaction. Invalid
 * journals, missing balances, and conflicting state reject.
 *
 * WHEN TO USE
 * Use in the background balance worker after a journal workflow requests
 * propagation. The input is a journal-entry ID, not a requested account
 * balance.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/adjust-ledger-account-balance.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

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
import {
  ILedgerAccountBalance,
  INewLedgerAccountBalanceAndAdjustment,
} from '@domain/ledger/types/ledger-account-balance.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { ledgerAccountBalanceAdjustmentDtoSchema } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoService: IRepoService;
  journalEntryRepo: IJournalEntryRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountBalanceAdjustmentService: ILedgerAccountBalanceAdjustmentService;
}

interface IPreparedLedgerAccountBalanceAdjustment {
  balanceAdjustment: INewLedgerAccountBalanceAndAdjustment;
  expectedVersion: number;
}

export default function makeAdjustLedgerAccountBalanceUseCase(
  deps: IDependencies
) {
  return async (payload: ILedgerAccountBalanceAdjustmentDto) => {
    zodValidationRunner(ledgerAccountBalanceAdjustmentDtoSchema, payload);

    const { correlationId } = deps.appContext.get();
    const { journalEntryId } = payload;
    const repoOptions = { correlationId };

    const preparedAdjustments = await prepareBalanceAdjustments(
      deps,
      journalEntryId,
      repoOptions
    );

    if (preparedAdjustments.length === 0) {
      return;
    }

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeRepoOptions = { ...repoOptions, tx: transaction.context };

      for (const preparedAdjustment of preparedAdjustments) {
        await deps.ledgerAccountBalanceRepo.adjustBalance(
          preparedAdjustment.balanceAdjustment,
          {
            ...writeRepoOptions,
            expectedVersion: preparedAdjustment.expectedVersion,
          }
        );
      }

      await transaction.commit();
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}

/**
 * Loads the journal, affected accounts and ancestors, and current balances.
 * Prepares adjustments in account-ID order before opening the write transaction.
 */
async function prepareBalanceAdjustments(
  deps: IDependencies,
  journalEntryId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<IPreparedLedgerAccountBalanceAdjustment[]> {
  const journalEntry = await deps.journalEntryRepo.findById(
    journalEntryId,
    repoOptions
  );

  if (!journalEntry) {
    throw new journalEntryError.InvalidJournalEntry({ journalEntryId });
  }

  const propagation =
    deps.ledgerAccountBalanceAdjustmentService.forJournal(journalEntry);
  const directAccounts = await deps.ledgerAccountRepo.findAllByIds(
    propagation.directAccountIds,
    journalEntry.accountingEntityId,
    repoOptions
  );
  const materializedPaths =
    ledgerAccountEntity.getMaterializedPaths(directAccounts);
  const accounts = await deps.ledgerAccountRepo.findAllByMaterializedPath(
    journalEntry.accountingEntityId,
    materializedPaths,
    repoOptions
  );

  const balanceDeltas = propagation.calculate(accounts);
  const orderedBalanceDeltas = [...balanceDeltas].sort((left, right) =>
    left.ledgerAccountId.localeCompare(right.ledgerAccountId)
  );
  const ledgerAccountIds = orderedBalanceDeltas.map(
    (balanceDelta) => balanceDelta.ledgerAccountId
  );
  const accountPaths = new Map(
    accounts.map((account) => [account.id, account.materializedPath])
  );
  const balances = await deps.ledgerAccountBalanceRepo.findAllByAccountIds(
    journalEntry.accountingEntityId,
    ledgerAccountIds,
    repoOptions
  );

  return prepareVersionedAdjustments(
    journalEntry,
    accountPaths,
    orderedBalanceDeltas,
    balances
  );
}

/**
 * Pairs changed balances with their read versions. Rejects missing balances
 * and changes to the hierarchy between the account and balance reads.
 */
function prepareVersionedAdjustments(
  journalEntry: IJournalEntry,
  accountPaths: ReadonlyMap<TEntityId, string>,
  balanceDeltas: ILedgerAccountBalanceDelta[],
  balances: ILedgerAccountBalance[]
): IPreparedLedgerAccountBalanceAdjustment[] {
  const balancesByAccountId = new Map(
    balances.map((balance) => [balance.ledgerAccountId, balance])
  );

  if (balancesByAccountId.size !== balanceDeltas.length) {
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

    const expectedPath = accountPaths.get(balanceDelta.ledgerAccountId);

    if (existingBalance.accountMaterializedPath !== expectedPath) {
      throw new ledgerAppError.BalanceHierarchyChanged();
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

    if (balanceAdjustment.newBalance === existingBalance) {
      continue;
    }

    preparedAdjustments.push({
      balanceAdjustment,
      expectedVersion: existingBalance.version,
    });
  }

  return preparedAdjustments;
}
