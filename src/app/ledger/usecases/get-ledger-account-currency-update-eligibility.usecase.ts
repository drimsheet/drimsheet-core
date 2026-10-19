import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import { TLedgerAccountCurrencyUpdateEligibilityDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountService: ILedgerAccountService;
}

export default function makeGetLedgerAccountCurrencyUpdateEligibilityUsecase(
  deps: IDependencies
) {
  return async (
    id: string
  ): Promise<TLedgerAccountCurrencyUpdateEligibilityDto> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id });
    }

    return deps.ledgerAccountService.canUpdateCurrency(account, repoOptions);
  };
}
