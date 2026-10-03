import express from 'express';
import request from 'supertest';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import { healthHandlers, mcpRouteHandler } from '@infra/ioc/handlers/http';
import { getJournalEntriesUseCase } from '@infra/ioc/usecases/journal-entry';
import { getLedgerAccountsUseCase } from '@infra/ioc/usecases/ledger';
import runtimeHealth from '@infra/server/health';

jest.mock('@infra/ioc/usecases/money', () => ({
  getExchangeRateUseCase: jest.fn(),
}));
jest.mock('@infra/ioc/usecases/counterparty', () => ({
  createCounterpartyUseCase: jest.fn(),
  getCounterpartiesUseCase: jest.fn(),
  getCounterpartyUseCase: jest.fn(),
}));

jest.mock('@infra/server/health', () => ({
  __esModule: true,
  default: { isReady: jest.fn() },
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { APP_URL: '', APP_ENV: 'local', APP_VERSION: '1.2.3', PORT: 0 },
}));
jest.mock('@infra/ioc/usecases/ledger', () => ({
  createBankAccountUseCase: jest.fn(),
  createExpenseAccountUseCase: jest.fn(),
  createPettyCashAccountUseCase: jest.fn(),
  createRevenueAccountUseCase: jest.fn(),
  createStatutoryPayableAccountUseCase: jest.fn(),
  createStatutoryReceivableAccountUseCase: jest.fn(),
  createSuspenseAccountUseCase: jest.fn(),
  createTradePayableAccountUseCase: jest.fn(),
  createTradeReceivableAccountUseCase: jest.fn(),
  getBanksUseCase: jest.fn(),
  getLedgerAccountUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getPermittedPostingAccountsUseCase: jest.fn(),
}));
jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  createOpeningBalanceUseCase: jest.fn(),
  createPaymentUseCase: jest.fn(),
  createReceiptUseCase: jest.fn(),
  createTransferUseCase: jest.fn(),
  getJournalEntriesUseCase: jest.fn(),
  getJournalEntryUseCase: jest.fn(),
}));
jest.mock('@infra/observability', () => ({
  __esModule: true,
  default: {
    reporter: jest.requireActual<
      typeof import('@shared/contracts/__mocks__/reporter.mock')
    >('@shared/contracts/__mocks__/reporter.mock').default,
  },
}));

describe('HTTP MCP handler composition', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    ['get_ledger_accounts', getLedgerAccountsUseCase],
    ['get_journal_entries', getJournalEntriesUseCase],
  ] as const)(
    'connects %s to its existing application entry point',
    async (name, useCase) => {
      const result = {
        data: [],
        meta: { limit: 10, page: 1, total: 0, totalPages: 0 },
      };
      jest.mocked(useCase).mockResolvedValue(result);
      const app = express();
      app.use(express.json());
      app.all('/mcp', mcpRouteHandler);
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost')
        .set('Accept', 'application/json, text/event-stream')
        .set('MCP-Protocol-Version', '2025-06-18')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: { limit: 5 } },
        });
      expect(response.status).toBe(200);
      expect(response.text).toContain(JSON.stringify(result));
      expect(useCase).toHaveBeenCalledWith({ limit: 5 });
      expect(mockReporter.report).not.toHaveBeenCalled();
    }
  );

  it('serves overlapping requests with independently wired MCP servers', async () => {
    const firstResult = {
      data: [],
      meta: { limit: 10, page: 1, total: 1, totalPages: 1 },
    };
    const secondResult = {
      data: [],
      meta: { limit: 10, page: 1, total: 2, totalPages: 1 },
    };
    let releaseCalls: () => void = () => {};
    const bothStarted = new Promise<void>((resolve) => {
      releaseCalls = resolve;
    });
    let startedCalls = 0;
    jest.mocked(getLedgerAccountsUseCase).mockImplementation(async (input) => {
      startedCalls += 1;
      if (startedCalls === 2) releaseCalls();
      await bothStarted;
      return input.limit === 1 ? firstResult : secondResult;
    });
    const app = express();
    app.use(express.json());
    app.all('/mcp', mcpRouteHandler);

    const responses = await Promise.all(
      [1, 2].map((limit) =>
        request(app)
          .post('/mcp')
          .set('Host', 'localhost')
          .set('Accept', 'application/json, text/event-stream')
          .set('MCP-Protocol-Version', '2025-06-18')
          .send({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'get_ledger_accounts', arguments: { limit } },
          })
      )
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0].text).toContain(JSON.stringify(firstResult));
    expect(responses[1].text).toContain(JSON.stringify(secondResult));
    expect(getLedgerAccountsUseCase).toHaveBeenCalledTimes(2);
    expect(mockReporter.report).not.toHaveBeenCalled();
  });
});

describe('HTTP health handler composition', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([true, false])(
    'uses runtime readiness %s for the ready handler',
    async (ready) => {
      jest.mocked(runtimeHealth.isReady).mockResolvedValue(ready);
      const response = await request(
        express().get('/ready', healthHandlers.ready)
      ).get('/ready');

      expect(response.status).toBe(ready ? 200 : 503);
      expect(runtimeHealth.isReady).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps the live handler independent of runtime readiness', async () => {
    const response = await request(
      express().get('/live', healthHandlers.live)
    ).get('/live');

    expect(response.status).toBe(200);
    expect(runtimeHealth.isReady).not.toHaveBeenCalled();
  });
});
