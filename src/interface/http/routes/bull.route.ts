import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';

import { getLedgerAccountBalanceAdjustmentQueue } from '@infra/messaging/queues/ledger-account-balance.queue';
import { getTransactionalEmailQueue } from '@infra/messaging/queues/transactional-email.queue';

let bullMqDashboardRouter: ReturnType<ExpressAdapter['getRouter']> | undefined;

function getBullMqDashboardRouter() {
  if (bullMqDashboardRouter) return bullMqDashboardRouter;

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/bullmq-board-admin');

  createBullBoard({
    queues: [
      new BullMQAdapter(getTransactionalEmailQueue()),
      new BullMQAdapter(getLedgerAccountBalanceAdjustmentQueue()),
    ],
    serverAdapter,
  });

  bullMqDashboardRouter = serverAdapter.getRouter();
  return bullMqDashboardRouter;
}

const router = Router();

router.use('/bullmq-board-admin', (request, response, next) =>
  getBullMqDashboardRouter()(request, response, next)
);

export default router;
