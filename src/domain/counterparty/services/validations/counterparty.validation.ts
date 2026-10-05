import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

/** Rejects an actual type change when references exist; uses the caller's locked transaction. */
async function validateTypeChangeAllowed(
  journalLineRepo: IJournalLineRepo,
  counterpartyId: TEntityId,
  accountingEntityId: TEntityId,
  options: IReadRepoOptions
): Promise<void> {
  const journalLines = await journalLineRepo.findAllByCounterpartyId(
    counterpartyId,
    accountingEntityId,
    options
  );

  const hasUsage = journalLines.length > 0;

  if (hasUsage)
    throw new counterpartyError.TypeChangeAfterTransactionUse({
      field: 'type',
      reason: 'transaction_usage',
      nextAction: 'create_counterparty',
    });
}

/** Rejects remaining references across every journal status in the caller's locked transaction. */
async function validateDeletionAllowed(
  journalLineRepo: IJournalLineRepo,
  counterpartyId: TEntityId,
  accountingEntityId: TEntityId,
  options: IReadRepoOptions
): Promise<void> {
  const journalLines = await journalLineRepo.findAllByCounterpartyId(
    counterpartyId,
    accountingEntityId,
    options
  );

  const hasTransactionReferences = journalLines.length > 0;

  if (hasTransactionReferences)
    throw new counterpartyError.DeletionWithTransactionReferences({
      reason: 'transaction_usage',
      nextAction: 'archive_counterparty',
    });
}

const counterpartyServiceValidation = Object.freeze({
  validateTypeChangeAllowed,
  validateDeletionAllowed,
});

export default counterpartyServiceValidation;
