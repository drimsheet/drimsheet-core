import {
  ERepoLock,
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

interface IControlAccountLookup {
  accountingEntityId: TEntityId;
  allocationHeaderCode: string;
  defaultControlAccountCode: string;
  controlAccountId?: TEntityId;
}

/**
 * Returns the selected control account under Update locks, locking the allocation root first.
 * Reuses the root when it is the default; reports missing explicit IDs separately from missing configured codes.
 * The caller owns eligibility validation and the transaction, retaining both locks through completion.
 */
export default async function getLockedControlAccountHelper(
  ledgerAccountRepo: ILedgerAccountRepo,
  payload: IControlAccountLookup,
  repoOptions: IReadRepoOptions & { tx: ITransactionContext }
): Promise<ILedgerAccount> {
  const lockedOptions = { ...repoOptions, lock: ERepoLock.Update };
  const header = await ledgerAccountRepo.findByCode(
    payload.allocationHeaderCode,
    payload.accountingEntityId,
    lockedOptions
  );
  if (!header)
    throw new ledgerAccountError.ControlAccountNotFound({
      controlAccountLedgerCode: payload.allocationHeaderCode,
    });
  controlAccountAvailabilityValidation.validate(header);

  if (payload.controlAccountId) {
    const controlAccount = await ledgerAccountRepo.findById(
      payload.controlAccountId,
      payload.accountingEntityId,
      lockedOptions
    );
    if (!controlAccount)
      throw new ledgerAccountError.ControlAccountIdNotFound({
        id: payload.controlAccountId,
      });
    return controlAccount;
  }

  const isDefaultRoot =
    payload.defaultControlAccountCode === payload.allocationHeaderCode;
  if (isDefaultRoot) return header;

  const controlAccount = await ledgerAccountRepo.findByCode(
    payload.defaultControlAccountCode,
    payload.accountingEntityId,
    lockedOptions
  );
  if (!controlAccount)
    throw new ledgerAccountError.ControlAccountNotFound({
      controlAccountLedgerCode: payload.defaultControlAccountCode,
    });
  return controlAccount;
}
