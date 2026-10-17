import { ICorrelationId } from '@shared/types/correlation-id.types';
import generateUUID from '@shared/utils/uuid-generator';

import { IAppContextData } from '@app/context/types/app-context.types';
import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { ledgerAccountBalanceAdjustmentWorker } from '@infra/ioc/workers/ledger';
import { transactionalEmailWorker } from '@infra/ioc/workers/notification';
import observability from '@infra/observability';
import appContext from '@infra/services/app-context.service';

function getInitialStore(payload: ICorrelationId): IAppContextData {
  return {
    correlationId: payload.correlationId || generateUUID(),
    idempotencyKey: '',
  };
}

function workerRegistration() {
  registerBullMQWorker<ITransactionalEmailDto>(
    TRANSACTIONAL_EMAIL_QUEUE_NAME,
    transactionalEmailWorker,
    appContext,
    getInitialStore,
    observability.queueMetrics,
    observability.tracer
  );

  registerBullMQWorker<ILedgerAccountBalanceAdjustmentDto>(
    LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME,
    ledgerAccountBalanceAdjustmentWorker,
    appContext,
    getInitialStore,
    observability.queueMetrics,
    observability.tracer
  );
}

export default workerRegistration;
