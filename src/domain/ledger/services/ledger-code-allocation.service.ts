import { ERepoLock } from '@shared/types/repo.types';

import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Selects the next family code under a caller-owned lock; never reserves, writes, or commits. */
function makeGetNextCode(
  deps: IDependencies
): ILedgerCodeAllocationService['getNextCode'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    const header = await deps.ledgerAccountRepo.findByCode(
      payload.allocationHeaderCode,
      payload.accountingEntityId,
      { ...repoOptions, lock: ERepoLock.Update }
    );
    if (!header)
      throw new ledgerAccountError.ControlAccountNotFound({
        controlAccountLedgerCode: payload.allocationHeaderCode,
      });

    controlAccountAvailabilityValidation.validate(header);

    // A separate Read Committed statement sees the preceding lock holder's insert.
    const latest = await deps.ledgerAccountRepo.findLatestBySubType(
      payload.accountingEntityId,
      payload.type,
      payload.subType,
      repoOptions
    );
    return getNextSubledgerAccountCode(
      header.code.slice(0, 3),
      latest?.code ?? header.code
    );
  };
}

export default function makeLedgerCodeAllocationService(
  deps: IDependencies
): ILedgerCodeAllocationService {
  return Object.freeze({ getNextCode: makeGetNextCode(deps) });
}
