import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import IRevenueAccountService from '@domain/ledger/types/revenue-account.service.types';

/** Enforces revenue update eligibility and prepares an immutable, audited name change without writing. */
function makeUpdate(): IRevenueAccountService['update'] {
  return (account, payload) => {
    if (account.type !== ELedgerType.Revenue) {
      throw new ledgerAccountError.InvalidType({
        expected: ELedgerType.Revenue,
        received: account.type,
      });
    }

    if (account.status === ELedgerAccountStatus.Archived) {
      throw new ledgerAccountError.InvalidStatus({ status: account.status });
    }

    return ledgerAccountEntity.update(account, { name: payload.name });
  };
}

export default function makeRevenueAccountService(): IRevenueAccountService {
  return Object.freeze({ update: makeUpdate() });
}
