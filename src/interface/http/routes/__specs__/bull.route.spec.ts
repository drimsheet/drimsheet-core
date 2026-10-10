import express from 'express';
import request from 'supertest';

import { getLedgerAccountBalanceAdjustmentQueue } from '@infra/messaging/queues/ledger-account-balance.queue';
import { getTransactionalEmailQueue } from '@infra/messaging/queues/transactional-email.queue';

import routes from '@interface/http/routes';

jest.mock('@infra/ioc/handlers/http', () => ({
  mcpRouteHandler: jest.fn(),
}));

jest.mock('@infra/messaging/queues/transactional-email.queue', () => ({
  getTransactionalEmailQueue: jest.fn(() => ({
    name: 'transactional-email',
    metaValues: { version: 'bullmq:test' },
  })),
}));
jest.mock('@infra/messaging/queues/ledger-account-balance.queue', () => ({
  getLedgerAccountBalanceAdjustmentQueue: jest.fn(() => ({
    name: 'ledger-balance',
    metaValues: { version: 'bullmq:test' },
  })),
}));

describe('BullMQ dashboard route', () => {
  it('does not initialize queues while assembling HTTP routes', () => {
    expect(getTransactionalEmailQueue).not.toHaveBeenCalled();
    expect(getLedgerAccountBalanceAdjustmentQueue).not.toHaveBeenCalled();
  });

  it('serves repeated dashboard requests without reinitializing the queues', async () => {
    const app = express().use(...routes);
    const response = await request(app).get('/bullmq-board-admin/');
    const repeatedResponse = await request(app).get('/bullmq-board-admin/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('/bullmq-board-admin');
    expect(repeatedResponse.status).toBe(200);
    expect(repeatedResponse.headers['content-type']).toContain('text/html');
    expect(repeatedResponse.text).toContain('/bullmq-board-admin');
    expect(getTransactionalEmailQueue).toHaveBeenCalledTimes(1);
    expect(getLedgerAccountBalanceAdjustmentQueue).toHaveBeenCalledTimes(1);
  });

  it('leaves other paths to the remaining routes', async () => {
    const response = await request(express().use(...routes)).get('/other');

    expect(response.status).toBe(404);
  });
});
