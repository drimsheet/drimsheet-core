import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { setCurrentAccountingPeriodWorker } from '@infra/ioc/workers/accounting';
import { ledgerAccountBalanceAdjustmentWorker } from '@infra/ioc/workers/ledger';
import { transactionalEmailWorker } from '@infra/ioc/workers/notification';
import observability from '@infra/observability';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';
import appContext from '@infra/services/app-context.service';

function registerTransactionalEmailWorker(): void {
  const worker = registerBullMQWorker<ITransactionalEmailDto>(
    TRANSACTIONAL_EMAIL_QUEUE_NAME,
    transactionalEmailWorker,
    appContext,
    observability.queueMetrics,
    observability.tracer
  );

  queueLifecycle.registerWorker(worker);
}

function registerLedgerAccountBalanceAdjustmentWorker(): void {
  const worker = registerBullMQWorker<ILedgerAccountBalanceAdjustmentDto>(
    LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME,
    ledgerAccountBalanceAdjustmentWorker,
    appContext,
    observability.queueMetrics,
    observability.tracer
  );

  queueLifecycle.registerWorker(worker);
}

function registerCurrentAccountingPeriodWorker(): void {
  const worker = registerBullMQWorker<INextCurrentAccountingPeriodDto>(
    CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
    setCurrentAccountingPeriodWorker,
    appContext,
    observability.queueMetrics,
    observability.tracer
  );

  queueLifecycle.registerWorker(worker);
}

export default Object.freeze([
  registerTransactionalEmailWorker,
  registerLedgerAccountBalanceAdjustmentWorker,
  registerCurrentAccountingPeriodWorker,
]);
