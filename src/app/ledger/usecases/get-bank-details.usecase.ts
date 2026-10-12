import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import {
  EAssetAccountBehavior,
  IBankDetails,
} from '@domain/ledger/types/asset-account.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  bankAccountRepo: IBankAccountRepo;
}

export default function makeGetBankDetailsUsecase(deps: IDependencies) {
  return async (accountId: TEntityId): Promise<IBankDetails> => {
    stringUtils.validateUUID(accountId, ledgerAccountError.InvalidId);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      accountId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) {
      throw new ledgerAppError.AccountNotFound();
    }
    if (account.behavior !== EAssetAccountBehavior.Bank) {
      throw new ledgerAccountError.InvalidBehavior({
        expected: EAssetAccountBehavior.Bank,
        received: account.behavior,
      });
    }

    const bankDetails = await deps.bankAccountRepo.findByLedgerAccountId(
      account.id,
      repoOptions
    );
    if (!bankDetails) {
      throw new ledgerAccountError.BankDetailsMissing({
        ledgerAccountId: account.id,
      });
    }

    return bankDetails;
  };
}
