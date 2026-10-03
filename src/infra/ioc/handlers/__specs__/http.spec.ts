import express from 'express';
import request from 'supertest';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';

import { healthHandlers, mcpRouteHandler } from '@infra/ioc/handlers/http';
import { getJournalEntriesUseCase } from '@infra/ioc/usecases/journal-entry';
import { getLedgerAccountsUseCase } from '@infra/ioc/usecases/ledger';
import runtimeHealth from '@infra/server/health';

jest.mock('@infra/server/health', () => ({
  __esModule: true,
  default: { isReady: jest.fn() },
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { APP_URL: '', APP_ENV: 'local', APP_VERSION: '1.2.3', PORT: 0 },
}));
jest.mock('@infra/ioc/usecases/ledger', () => ({
  getLedgerAccountsUseCase: jest.fn(),
}));
jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  getJournalEntriesUseCase: jest.fn(),
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
