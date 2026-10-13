import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import controlAccountChildStatusValidation from '@domain/ledger/services/validations/control-account-child-status.validation';
import IExpenseAccountService from '@domain/ledger/types/expense-account.service.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Activates a draft expense account beneath an active parent without persisting. */
function makeActivate(deps: IDependencies): IExpenseAccountService['activate'] {
  return async (account, repoOptions) => {
    if (account.type !== ELedgerType.Expense) {
      throw new ledgerAccountError.InvalidType({
        expected: ELedgerType.Expense,
        received: account.type,
      });
    }
    if (!account.controlAccountId) {
      throw new ledgerAccountError.InvalidControlAccountId();
    }

    const controlAccount = await deps.ledgerAccountRepo.findById(
      account.controlAccountId,
      account.accountingEntityId,
      repoOptions
    );
    if (!controlAccount) {
      throw new ledgerAccountError.ControlAccountNotFound();
    }
    controlAccountAvailabilityValidation.validate(controlAccount);
    controlAccountChildStatusValidation.validate(
      controlAccount.status,
      ELedgerAccountStatus.Active
    );

    return ledgerAccountEntity.activate(account);
  };
}

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

export default function makeExpenseAccountService(
  deps: IDependencies
): IExpenseAccountService {
  return Object.freeze({
    update: makeUpdate(),
    activate: makeActivate(deps),
  });
}
