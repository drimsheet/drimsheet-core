import type setupServer from '@infra/runtime/servers/express';

const mockLoadOrder: string[] = [];
let mockBootstrap: Parameters<typeof setupServer>[0];

jest.mock('@infra/runtime/bootstrap/observability.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(() => {
    mockLoadOrder.push('observability');
  }),
}));

jest.mock('@infra/runtime/servers/express', () => {
  mockLoadOrder.push('server-module');

  return {
    __esModule: true,
    default: jest.fn((bootstrap: () => Promise<void>) => {
      mockLoadOrder.push('listen');
      mockBootstrap = bootstrap;
    }),
  };
});

jest.mock('@infra/messaging/workers', () => {
  mockLoadOrder.push('workers-module');

  return {
    __esModule: true,
    default: [
      () => {
        mockLoadOrder.push('workers');
      },
    ],
  };
});

jest.mock('@infra/runtime/bootstrap/feature-flag.bootstrap', () => {
  mockLoadOrder.push('feature-flags-module');

  return {
    __esModule: true,
    default: jest.fn(async () => {
      await Promise.resolve();
      mockLoadOrder.push('feature-flags');
    }),
  };
});

jest.mock('@infra/runtime/bootstrap/currencies.bootstrap', () => {
  mockLoadOrder.push('currencies-module');

  return {
    __esModule: true,
    default: jest.fn(async () => {
      await Promise.resolve();
      mockLoadOrder.push('currencies');
    }),
  };
});

jest.mock('@infra/runtime/bootstrap/accounting-context.bootstrap', () => {
  mockLoadOrder.push('accounting-context-module');

  return {
    bootstrapAccountingContext: jest.fn(async () => {
      await Promise.resolve();
      mockLoadOrder.push('accounting-context');
    }),
  };
});

jest.mock('@infra/runtime/bootstrap/events.bootstrap', () => {
  mockLoadOrder.push('events-module');

  return {
    __esModule: true,
    default: jest.fn(() => {
      mockLoadOrder.push('events');
    }),
  };
});

describe('HTTP runtime bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadOrder.length = 0;
    mockBootstrap = undefined;
  });

  it('initializes observability before dependencies and bootstraps in order after listening', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('@infra/runtime/process/http.process');
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLoadOrder[0]).toBe('observability');
      expect(mockLoadOrder.slice(1, -1).sort()).toEqual([
        'accounting-context-module',
        'currencies-module',
        'events-module',
        'feature-flags-module',
        'server-module',
      ]);
      expect(mockLoadOrder[mockLoadOrder.length - 1]).toBe('listen');
      expect(mockBootstrap).toBeDefined();

      await mockBootstrap!();

      expect(mockLoadOrder.slice(-4)).toEqual([
        'feature-flags',
        'currencies',
        'accounting-context',
        'events',
      ]);
      expect(mockLoadOrder).not.toContain('workers-module');
      expect(mockLoadOrder).not.toContain('workers');
    });
  });
});
