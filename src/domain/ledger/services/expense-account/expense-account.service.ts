import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IExpenseAccountService from '@domain/ledger/types/expense-account.service.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';

/** Enforces expense update eligibility and prepares an immutable, audited name change without writing. */
function makeUpdate(): IExpenseAccountService['update'] {
  return (account, payload) => {
    if (account.type !== ELedgerType.Expense) {
      throw new ledgerAccountError.InvalidType({
        expected: ELedgerType.Expense,
        received: account.type,
      });
    }

    if (account.status === ELedgerAccountStatus.Archived) {
      throw new ledgerAccountError.InvalidStatus({ status: account.status });
    }

    return ledgerAccountEntity.update(account, { name: payload.name });
  };
}

export default function makeExpenseAccountService(): IExpenseAccountService {
  return Object.freeze({ update: makeUpdate() });
}
