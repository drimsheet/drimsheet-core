import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';

import { getLedgerAccountBalanceAdjustmentQueue } from '@infra/messaging/queues/ledger-account-balance.queue';
import { getTransactionalEmailQueue } from '@infra/messaging/queues/transactional-email.queue';

const bullMqServerAdapter = new ExpressAdapter();

bullMqServerAdapter.setBasePath('/bullmq-board-admin');

createBullBoard({
  queues: [
    new BullMQAdapter(getTransactionalEmailQueue()),
    new BullMQAdapter(getLedgerAccountBalanceAdjustmentQueue()),
  ],
  serverAdapter: bullMqServerAdapter,
});

const router = Router();

router.use('/bullmq-board-admin', bullMqServerAdapter.getRouter());

export default router;
