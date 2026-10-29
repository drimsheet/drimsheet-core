/**
 * SUMMARY
 * Retrieves stored balances by ledger code in the selected entity.
 * Rejects a missing account or balance.
 *
 * WHEN TO USE
 * Use to read current, eventually consistent ledger account balances.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { ILedgerAccountBalanceDto } from '@app/ledger/dtos/ledger-account/ledger-account-balance.dto';
import ledgerAccountBalanceMapper from '@app/ledger/dtos/ledger-account/ledger-account-balance.dto.mapper';
import { getLedgerAccountBalanceQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account-balance.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

export default function makeGetLedgerAccountBalanceUsecase(
  deps: IDependencies
) {
  return async (code: string): Promise<ILedgerAccountBalanceDto> => {
    zodValidationRunner(getLedgerAccountBalanceQueryValidationSchema, { code });

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findByCode(
      code,
      accountingEntity.id,
      repoOptions
    );

    if (!account) {
      throw new ledgerAppError.AccountNotFound();
    }

    const accountBalance = await deps.ledgerAccountBalanceRepo.findByAccountId(
      account.id,
      accountingEntity.id,
      repoOptions
    );

    if (!accountBalance) {
      throw new ledgerAppError.BalanceNotFound({ accountId: account.id });
    }

    return ledgerAccountBalanceMapper.toDto(accountBalance);
  };
}
