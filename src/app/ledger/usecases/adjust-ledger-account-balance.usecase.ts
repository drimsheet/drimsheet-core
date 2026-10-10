import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import IReporter from '@shared/contracts/reporter.contract';
import { EOutboxType } from '@shared/types/outbox.types';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import ILedgerBalancePropagationPreparationAppService from '@app/ledger/contracts/ledger-balance-propagation-preparation.service.contract';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { ledgerAccountBalanceAdjustmentDtoSchema } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IOutboxRepo from '@app/outbox/contracts/outbox.repo.contract';

interface IDependencies {
  repoService: IRepoService;
  outboxRepo: IOutboxRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  balancePropagationPreparationAppService: ILedgerBalancePropagationPreparationAppService;
  reporter: IReporter;
}

export default function makeAdjustLedgerAccountBalanceUseCase(
  deps: IDependencies
) {
  return async (payload: ILedgerAccountBalanceAdjustmentDto) => {
    zodValidationRunner(ledgerAccountBalanceAdjustmentDtoSchema, payload);

    const { correlationId, journalEntryId } = payload;
    const repoOptions = { correlationId };

    const outbox = await deps.outboxRepo.findByIdAndType(
      journalEntryId,
      EOutboxType.BalancePropagation,
      repoOptions
    );

    if (!outbox) {
      deps.reporter.report(
        'ledger.balance_outbox.missing',
        new ledgerAppError.BalancePropagationOutboxNotFound({
          journalEntryId,
        })
      );

      return;
    }

    const preparedAdjustments =
      await deps.balancePropagationPreparationAppService.prepare(
        journalEntryId,
        repoOptions
      );

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeRepoOptions = { ...repoOptions, tx };

      for (const preparedAdjustment of preparedAdjustments) {
        await deps.ledgerAccountBalanceRepo.adjustBalance(
          preparedAdjustment.balanceAdjustment,
          {
            ...writeRepoOptions,
            expectedVersion: preparedAdjustment.expectedVersion,
          }
        );
      }

      await deps.outboxRepo.delete(journalEntryId, writeRepoOptions);
    };

    await deps.repoService.runInTransaction(transactionFn);
  };
}
