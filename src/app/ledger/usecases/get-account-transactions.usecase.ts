import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';
import paginationMapper from '@shared/values/pagination/dto/pagination.dto.mapper';
import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import ledgerBalanceEffectRule from '@domain/accounting/rules/ledger-balance-effect.rule';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import IAccountTransactionQueryRepo from '@app/ledger/contracts/account-transaction.query.repo.contract';
import { IAccountTransactionRes } from '@app/ledger/dtos/account-transaction/account-transaction.dto';
import accountTransactionMapper from '@app/ledger/dtos/account-transaction/account-transaction.dto.mapper';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  accountTransactionQueryRepo: IAccountTransactionQueryRepo;
}

export default function makeGetAccountTransactionsUseCase(deps: IDependencies) {
  return async (
    accountId: TEntityId,
    pagination: IPaginationDto
  ): Promise<IPaginatedResponse<IAccountTransactionRes>> => {
    zodValidationRunner(paginationDtoValidation, pagination);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const ledgerAccount = await deps.ledgerAccountRepo.findById(
      accountId,
      accountingEntity.id,
      repoOptions
    );

    if (!ledgerAccount) {
      throw new ledgerAppError.AccountNotFound();
    }

    const transactions =
      await deps.accountTransactionQueryRepo.findAllByAccountId(accountId, {
        ...repoOptions,
        ...paginationMapper.fromDto(pagination),
      });

    const data: IAccountTransactionRes[] = transactions.data.map((trx) => ({
      ...accountTransactionMapper.toDto(trx),
      balanceEffect: ledgerBalanceEffectRule(ledgerAccount, trx.side),
    }));

    return {
      data,
      meta: transactions.meta,
    };
  };
}
