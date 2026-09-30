import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import ILedgerCodeAssignmentAppService from '@app/ledger/contracts/ledger-code-assignment.service.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/**
 * Returns the account's audited code update under the caller's allocation lock.
 * Errors propagate and the lock lasts through the caller's transaction.
 */
function makeAssign(
  deps: IDependencies
): ILedgerCodeAssignmentAppService['assign'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAppError.AssignmentTransactionRequired();

    const { account } = payload;
    const header = await deps.ledgerAccountRepo.findByCodeForUpdate(
      payload.allocationHeaderCode,
      account.accountingEntityId,
      repoOptions
    );
    if (!header) {
      throw new ledgerAccountError.ControlAccountNotFound({
        controlAccountLedgerCode: payload.allocationHeaderCode,
      });
    }

    // Separate statement after acquiring the shared header lock: Read Committed
    // sees the previous lock holder's committed insert, even if this request waited.
    const latest = await deps.ledgerAccountRepo.findLatestBySubType(
      account.accountingEntityId,
      account.type,
      account.subType,
      repoOptions
    );
    return ledgerAccountEntity.assignNextCode(account, latest ?? header);
  };
}

export default function makeLedgerCodeAssignmentAppService(
  deps: IDependencies
): ILedgerCodeAssignmentAppService {
  return Object.freeze({ assign: makeAssign(deps) });
}
