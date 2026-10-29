/**
 * SUMMARY
 * Applies a journal's effects to derived balances for affected accounts and
 * their ancestors. Requires pending balance-propagation work; missing work is
 * reported and returns without adjustment. Saves prepared adjustments and
 * removes the pending work together. Invalid journals, missing balances, and
 * conflicting state reject. Returns no value and publishes no domain events.
 *
 * WHEN TO USE
 * Use in the background balance worker after a journal workflow requests
 * propagation. The input is a journal-entry ID, not a requested account
 * balance.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/adjust-ledger-account-balance.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import IReporter from '@shared/contracts/reporter.contract';
import { EOutboxType } from '@shared/types/outbox.types';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerBalancePropagationPreparationAppService from '@app/ledger/contracts/ledger-balance-propagation-preparation.service.contract';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { ledgerAccountBalanceAdjustmentDtoSchema } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IOutboxRepo from '@app/outbox/contracts/outbox.repo.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
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

    const { correlationId } = deps.appContext.get();
    const { journalEntryId } = payload;
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
