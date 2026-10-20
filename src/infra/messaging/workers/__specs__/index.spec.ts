import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';
import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { ledgerAccountBalanceAdjustmentWorker } from '@infra/ioc/workers/ledger';
import { transactionalEmailWorker } from '@infra/ioc/workers/notification';
import workerRegistration from '@infra/messaging/workers';

jest.mock('@shared/utils/uuid-generator');

jest.mock('@infra/config/bullmq.config', () => ({
  registerBullMQWorker: jest.fn(),
}));

jest.mock('@infra/ioc/workers/ledger', () => ({
  ledgerAccountBalanceAdjustmentWorker: jest.fn(),
}));

jest.mock('@infra/ioc/workers/notification', () => ({
  transactionalEmailWorker: jest.fn(),
}));

jest.mock('@infra/observability', () => ({
  __esModule: true,
  default: {
    queueMetrics: jest.requireActual(
      '@shared/contracts/__mocks__/queue-metrics.mock'
    ).default,
    tracer: jest.requireActual('@shared/contracts/__mocks__/tracer.mock')
      .default,
  },
}));

describe('workerRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(generateUUID)
      .mockReturnValue('generated-correlation' as TEntityId);
  });

  it('registers each worker with its queue and processor', () => {
    workerRegistration();

    expect(registerBullMQWorker).toHaveBeenCalledTimes(2);
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      1,
      TRANSACTIONAL_EMAIL_QUEUE_NAME,
      transactionalEmailWorker,
      expect.any(Object),
      expect.any(Function),
      expect.any(Object),
      expect.any(Object)
    );
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      2,
      LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME,
      ledgerAccountBalanceAdjustmentWorker,
      expect.any(Object),
      expect.any(Function),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('maps the payload correlation and existing idempotency default', () => {
    workerRegistration();
    const getInitialStore = jest.mocked(registerBullMQWorker).mock.calls[0][3];

    const initialStore = getInitialStore({
      correlationId: 'payload-correlation',
    } as ITransactionalEmailDto);

    expect(initialStore).toEqual({
      correlationId: 'payload-correlation',
      idempotencyKey: '',
    });
  });

  it('generates a correlation when an unvalidated payload omits it', () => {
    workerRegistration();
    const getInitialStore = jest.mocked(registerBullMQWorker).mock.calls[1][3];

    const initialStore = getInitialStore({
      correlationId: '',
    } as ILedgerAccountBalanceAdjustmentDto);

    expect(initialStore.correlationId).toBe('generated-correlation');
  });
});
