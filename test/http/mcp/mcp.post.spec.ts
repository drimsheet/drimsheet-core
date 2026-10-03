import { setImmediate } from 'node:timers/promises';

import { Express, Router } from 'express';
import request from 'supertest';

import mockHttpMetrics from '@shared/contracts/__mocks__/http-metrics.mock';
import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';

import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import makeGetJournalEntriesUsecase from '@app/journal-entry/usecases/get-journal-entries.usecase';
import mockBalanceEnrichment from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeGetLedgerAccountsUsecase from '@app/ledger/usecases/get-ledger-accounts.usecase';

import { configureRateLimiter } from '@infra/config/rate-limiter.config';
import vars from '@infra/config/vars.config';
import httpHandlers, { mcpRouteHandler } from '@infra/ioc/handlers/http';
import httpMiddlewares from '@infra/ioc/middlewares/http';
import { getJournalEntriesUseCase } from '@infra/ioc/usecases/journal-entry';
import { getLedgerAccountsUseCase } from '@infra/ioc/usecases/ledger';
import appContext from '@infra/runtime/app-context';

import createApplication from '@interface/http/application';
import makeHttpErrorHandler from '@interface/http/handlers/error.handler';
import makeMcpRouteHandler from '@interface/http/handlers/mcp-route.handler';
import makeAppContextInitMiddleware from '@interface/http/middlewares/app-context-init.middleware';
import makeErrorHandlerMiddleware from '@interface/http/middlewares/error-handler.middleware';
import makeRequestLoggerMiddleware from '@interface/http/middlewares/request-logger.middleware';
import createMcpServer from '@interface/mcp/server';

jest.mock('@infra/ioc/usecases/money', () => ({
  getExchangeRateUseCase: jest.fn(),
}));
jest.mock('@infra/ioc/usecases/counterparty', () => ({
  createCounterpartyUseCase: jest.fn(),
  getCounterpartiesUseCase: jest.fn(),
  getCounterpartyUseCase: jest.fn(),
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

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock('@infra/ioc/middlewares/http', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@infra/ioc/handlers/http', () => ({
  __esModule: true,
  default: {},
  mcpRouteHandler: jest.fn(),
  healthHandlers: jest
    .requireActual<
      typeof import('@interface/http/handlers/health.handler')
    >('@interface/http/handlers/health.handler')
    .default({
      isReady: async () => false,
    }),
}));
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { APP_URL: 'https://core.test', NODE_ENV: 'test' },
}));
jest.mock('@interface/http/routes/bull.route', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('express')>('express').Router(),
}));
jest.mock('@infra/server/swagger', () => ({
  __esModule: true,
  default: () => [Router()],
}));
jest.mock('../../../generated/routes', () => ({
  RegisterRoutes: (app: Express) => {
    app.get('/existing', (_req, res) => {
      res.json({ ok: true });
    });
  },
}));

const [firstEntity] = accountingEntityEntity.make({
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  name: 'First',
  type: EAccountingEntityType.Individual,
  ownerId: generateUUID(),
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
});
const [secondEntity] = accountingEntityEntity.make({
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  name: 'Second',
  type: EAccountingEntityType.Individual,
  ownerId: generateUUID(),
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
});
const firstCorrelationId = generateUUID();
const secondCorrelationId = generateUUID();
const meta = { page: 1, limit: 10, total: 0, totalPages: 0 };

describe('POST /mcp', () => {
  let app: Express;
  let servers: ReturnType<typeof createMcpServer>[];
  let createServer: jest.Mock<ReturnType<typeof createMcpServer>, []>;

  beforeEach(() => {
    jest.resetAllMocks();
    mockLedgerAccountRepo.findAll.mockResolvedValue({ data: [], meta });
    mockJournalEntryQueryRepo.findAll.mockResolvedValue({ data: [], meta });
    mockBalanceEnrichment.enrich.mockResolvedValue([]);
    jest.mocked(getLedgerAccountsUseCase).mockImplementation(
      makeGetLedgerAccountsUsecase({
        appContext,
        ledgerAccountRepo: mockLedgerAccountRepo,
        balanceEnrichmentService: mockBalanceEnrichment,
      })
    );
    jest.mocked(getJournalEntriesUseCase).mockImplementation(
      makeGetJournalEntriesUsecase({
        appContext,
        journalEntryQueryRepo: mockJournalEntryQueryRepo,
      })
    );
    httpMiddlewares.appContextInit = makeAppContextInitMiddleware(
      appContext,
      vars
    );
    httpMiddlewares.requestLogger = makeRequestLoggerMiddleware(
      mockLogger,
      mockHttpMetrics
    );
    httpMiddlewares.globalRateLimiter = configureRateLimiter(
      { scope: 'global', max: 20, windowMs: 60_000 },
      mockReporter
    );
    // Fixture-only enrichment exercises real use cases without choosing MCP auth.
    httpMiddlewares.appContextEnrichment = (_req, _res, next) => {
      const { correlationId } = appContext.get();
      if (correlationId === firstCorrelationId)
        appContext.set({ accountingEntity: firstEntity });
      if (correlationId === secondCorrelationId)
        appContext.set({ accountingEntity: secondEntity });
      next();
    };
    httpHandlers.error = makeHttpErrorHandler({
      reporter: mockReporter,
      logger: mockLogger,
      nodeEnv: 'test',
    });
    httpMiddlewares.errorHandler = makeErrorHandlerMiddleware();
    servers = [];
    createServer = jest.fn(() => {
      const server = createMcpServer({ version: 'test' });
      jest.spyOn(server, 'connect');
      jest.spyOn(server, 'close');
      servers.push(server);
      return server;
    });
    jest.mocked(mcpRouteHandler).mockImplementation(
      makeMcpRouteHandler({
        appUrl: 'https://core.test',
        isLocal: false,
        createServer,
      })
    );
    app = createApplication();
  });

  afterEach(async () => {
    await setImmediate();
    for (const server of servers) {
      expect(server.close).toHaveBeenCalled();
      await server.close();
    }
  });

  function post(method: string, params?: object) {
    return request(app)
      .post('/mcp')
      .set('Host', 'core.test')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', '2025-06-18')
      .send({ jsonrpc: '2.0', id: 1, method, params });
  }

  function readResponse(response: { text: string }) {
    const eventData = response.text
      .split('\n')
      .find((line) => line.startsWith('data: '));
    return JSON.parse(eventData ? eventData.slice(6) : response.text);
  }

  describe('200 Response', () => {
    it('discovers the tools through the assembled application and preserves correlation', async () => {
      const response = await post('tools/list').set(
        'x-correlation-id',
        firstCorrelationId
      );
      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBe(firstCorrelationId);
      expect(readResponse(response).result.tools).toHaveLength(23);
      expect(response.headers['mcp-session-id']).toBeUndefined();
      expect(mockHttpMetrics.recordRequestCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 200 })
      );
    });

    it('negotiates the supported legacy protocol through the SDK', async () => {
      const response = await post('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'integration-test', version: '1.0.0' },
      });
      expect(response.status).toBe(200);
      expect(readResponse(response).result).toEqual(
        expect.objectContaining({
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'drimsheet-core', version: 'test' },
        })
      );
    });

    it.each(['get_ledger_accounts', 'get_journal_entries'])(
      'calls %s with existing entity context and pagination',
      async (name) => {
        const response = await post('tools/call', {
          name,
          arguments: { page: 2, limit: 5 },
        }).set('x-correlation-id', firstCorrelationId);
        expect(response.status).toBe(200);
        expect(readResponse(response).result.structuredContent).toEqual({
          data: [],
          meta,
        });
        const repo =
          name === 'get_ledger_accounts'
            ? mockLedgerAccountRepo
            : mockJournalEntryQueryRepo;
        expect(repo.findAll).toHaveBeenCalledWith(
          firstEntity.id,
          expect.objectContaining({
            limit: 5,
            offset: 5,
            correlationId: firstCorrelationId,
          })
        );
      }
    );

    it('uses existing pagination defaults for omitted arguments', async () => {
      const response = await post('tools/call', {
        name: 'get_ledger_accounts',
        arguments: {},
      }).set('x-correlation-id', firstCorrelationId);
      expect(readResponse(response).result.isError).not.toBe(true);
      expect(mockLedgerAccountRepo.findAll).toHaveBeenCalledWith(
        firstEntity.id,
        expect.objectContaining({ offset: 0 })
      );
    });

    it('fails safely before repository access when entity context is absent', async () => {
      const response = await post('tools/call', {
        name: 'get_ledger_accounts',
        arguments: {},
      });
      expect(response.status).toBe(200);
      expect(readResponse(response).result).toEqual({
        isError: true,
        content: [
          { type: 'text', text: '{"errorKey":"app_error_unexpected"}' },
        ],
      });
      expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
      expect(mockReporter.report).toHaveBeenCalledTimes(1);
    });

    it('keeps overlapping requests in their own accounting contexts', async () => {
      const seenContexts: string[] = [];
      mockJournalEntryQueryRepo.findAll.mockImplementation(
        async (entityId, options) => {
          await setImmediate();
          const context = appContext.get(['accountingEntity']);
          expect(context.accountingEntity.id).toBe(entityId);
          expect(context.correlationId).toBe(options.correlationId);
          seenContexts.push(entityId);
          return {
            data: [],
            meta: { ...meta, total: entityId === firstEntity.id ? 1 : 2 },
          };
        }
      );
      const responses = await Promise.all([
        post('tools/call', { name: 'get_journal_entries', arguments: {} }).set(
          'x-correlation-id',
          firstCorrelationId
        ),
        post('tools/call', { name: 'get_journal_entries', arguments: {} }).set(
          'x-correlation-id',
          secondCorrelationId
        ),
      ]);
      expect(createServer).toHaveBeenCalledTimes(2);
      expect(servers[0]).not.toBe(servers[1]);
      expect(
        responses.map(
          (response) =>
            readResponse(response).result.structuredContent.meta.total
        )
      ).toEqual([1, 2]);
      expect(seenContexts.sort()).toEqual(
        [firstEntity.id, secondEntity.id].sort()
      );
    });

    it('rejects malformed tool input before repository access', async () => {
      const response = await post('tools/call', {
        name: 'get_ledger_accounts',
        arguments: { limit: 201 },
      }).set('x-correlation-id', firstCorrelationId);
      expect(readResponse(response).result.isError).toBe(true);
      expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    });

    it('preserves health ordering and existing REST routes', async () => {
      const health = await request(app).get('/health/live');
      expect(health.status).toBe(200);
      expect(health.headers['x-correlation-id']).toBeUndefined();
      const existing = await request(app).get('/existing');
      expect(existing.status).toBe(200);
      expect(existing.body).toEqual({ ok: true });
      expect(existing.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('400 Response', () => {
    it('rejects an unsupported protocol version', async () => {
      const response = await post('tools/list').set(
        'MCP-Protocol-Version',
        '2099-01-01'
      );
      expect(response.status).toBe(400);
    });
  });

  describe('403 Response', () => {
    it('rejects unrecognized hosts before MCP dispatch', async () => {
      const response = await post('tools/list').set('Host', 'attacker.test');
      expect(response.status).toBe(403);
      expect(createServer).not.toHaveBeenCalled();
    });

    it('preserves the existing Origin rejection', async () => {
      const response = await post('tools/list').set(
        'Origin',
        'https://attacker.test'
      );
      expect(response.status).toBe(403);
      expect(createServer).not.toHaveBeenCalled();
    });
  });

  describe('405 Response', () => {
    it('lets the SDK reject unsupported HTTP methods', async () => {
      const response = await request(app).put('/mcp').set('Host', 'core.test');
      expect(response.status).toBe(405);
    });
  });

  describe('500 Response', () => {
    it('retains the JSON body size limit', async () => {
      const response = await post('tools/call', {
        name: 'get_ledger_accounts',
        arguments: { search: 'x'.repeat(110_000) },
      });
      // The current application error handler sanitizes parser failures as 500.
      expect(response.status).toBe(500);
      expect(createServer).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('429 Response', () => {
    it('retains the global limiter before the MCP route', async () => {
      for (let index = 0; index < 20; index += 1) await post('tools/list');
      const response = await post('tools/list');
      expect(response.status).toBe(429);
      expect(response.body.errorKey).toBe('app_error_too_many_requests');
      expect(mockReporter.reportAbuse).toHaveBeenCalledTimes(1);
    });
  });
});
