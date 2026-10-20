import observability from '@infra/observability';

import makeCurrentAccountingPeriodQueue from './current-accounting-period.queue';
import makeCurrentReportingPeriodQueue from './current-reporting-period.queue';
import makeLedgerAccountBalanceAdjustmentQueue from './ledger-account-balance.queue';
import makeTransactionalEmailQueue from './transactional-email.queue';

const queues = Object.freeze({
  currentAccountingPeriod: makeCurrentAccountingPeriodQueue(
    observability.tracer
  ),

  currentReportingPeriod: makeCurrentReportingPeriodQueue(observability.tracer),

  ledgerBalanceAdjustment: makeLedgerAccountBalanceAdjustmentQueue(
    observability.reporter,
    observability.queueMetrics,
    observability.tracer
  ),

  transactionalEmail: makeTransactionalEmailQueue(
    observability.reporter,
    observability.queueMetrics,
    observability.tracer
  ),
});

export default queues;
