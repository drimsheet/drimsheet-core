/**
 * SUMMARY
 * Returns an account's deletion eligibility and a reason when denied. Root
 * accounts are denied; drafts pass this preview; other accounts must have no
 * journal references. Rejects a missing account in the selected entity. Does
 * not validate the full subtree or the associated journals that deletion will
 * inspect.
 *
 * WHEN TO USE
 * Use to guide deletion controls. Invoke delete-ledger-account for fresh checks
 * of the complete removal; a positive preview does not guarantee success.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import { TLedgerAccountDeletionEligibilityDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountService: ILedgerAccountService;
}

export default function makeGetLedgerAccountDeletionEligibilityUsecase(
  deps: IDependencies
) {
  return async (id: string): Promise<TLedgerAccountDeletionEligibilityDto> => {
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

    return deps.ledgerAccountService.canDelete(account, repoOptions);
  };
}
