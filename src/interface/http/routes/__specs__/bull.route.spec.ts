import express from 'express';
import request from 'supertest';

import routes from '@interface/http/routes';

jest.mock('@infra/ioc/handlers/http', () => ({
  mcpRouteHandler: jest.fn(),
}));

jest.mock('@infra/messaging/queues/transactional-email.queue', () => ({
  getTransactionalEmailQueue: () => ({
    name: 'transactional-email',
    metaValues: { version: 'bullmq:test' },
  }),
}));
jest.mock('@infra/messaging/queues/ledger-account-balance.queue', () => ({
  getLedgerAccountBalanceAdjustmentQueue: () => ({
    name: 'ledger-balance',
    metaValues: { version: 'bullmq:test' },
  }),
}));

describe('BullMQ dashboard route', () => {
  it('serves the dashboard beneath its declared path', async () => {
    const response = await request(express().use(...routes)).get(
      '/bullmq-board-admin/'
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('/bullmq-board-admin');
  });

  it('leaves other paths to the remaining routes', async () => {
    const response = await request(express().use(...routes)).get('/other');

    expect(response.status).toBe(404);
  });
});
