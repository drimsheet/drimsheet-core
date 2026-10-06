import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Selects the next family code after the caller locks and validates the allocation header. */
function makeGetNextCode(
  deps: IDependencies
): ILedgerCodeAllocationService['getNextCode'] {
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

export default function makeLedgerCodeAllocationService(
  deps: IDependencies
): ILedgerCodeAllocationService {
  return Object.freeze({ getNextCode: makeGetNextCode(deps) });
}
