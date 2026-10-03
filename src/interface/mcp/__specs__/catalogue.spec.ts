import { createMcpHandler } from '@modelcontextprotocol/server';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import appError from '@shared/values/errors/app.error';

import createMcpServer from '@interface/mcp/server';

jest.mock('@infra/ioc/usecases/counterparty', () => ({
  createCounterpartyUseCase: jest.fn(),
  getCounterpartiesUseCase: jest.fn(),
  getCounterpartyUseCase: jest.fn(),
}));
jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  createOpeningBalanceUseCase: jest.fn(),
  createPaymentUseCase: jest.fn(),
  createReceiptUseCase: jest.fn(),
  createTransferUseCase: jest.fn(),
  getJournalEntriesUseCase: jest.fn(),
  getJournalEntryUseCase: jest.fn(),
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
jest.mock('@infra/ioc/usecases/money', () => ({
  getExchangeRateUseCase: jest.fn(),
}));
jest.mock('@infra/observability', () => ({
  __esModule: true,
  default: {
    reporter: jest.requireActual<
      typeof import('@shared/contracts/__mocks__/reporter.mock')
    >('@shared/contracts/__mocks__/reporter.mock').default,
  },
}));

type TUseCase = jest.Mock<Promise<unknown>, [unknown]>;
const counterparty = jest.requireMock<Record<string, TUseCase>>(
  '@infra/ioc/usecases/counterparty'
);
const journal = jest.requireMock<Record<string, TUseCase>>(
  '@infra/ioc/usecases/journal-entry'
);
const ledger = jest.requireMock<Record<string, TUseCase>>(
  '@infra/ioc/usecases/ledger'
);
const money = jest.requireMock<Record<string, TUseCase>>(
  '@infra/ioc/usecases/money'
);
const id = 'a1111111-1111-4111-8111-111111111111';
const timestamp = '2026-01-01T00:00:00.000Z';
const amount = { amount: 12500, currencyCode: 'NGN', isMinorUnit: true };
const exchangeRate = {
  baseCurrencyCode: 'USD',
  targetCurrencyCode: 'NGN',
  rate: 1500,
  type: 'official',
  asOf: timestamp,
  source: 'Central Bank',
};
const openingBalance = { amount, exchangeRate, date: timestamp };
const counterpartyDetails = { name: 'Supplier', type: 'organization' };
const line = {
  accountId: id,
  counterparty: counterpartyDetails,
  amount,
  exchangeRate,
  description: null,
  sequenceOrder: 1,
};
const transferLine = {
  accountId: id,
  amount,
  exchangeRate,
  description: null,
  sequenceOrder: 1,
};
const journalFields = {
  effectiveDate: timestamp,
  postedAt: timestamp,
  memo: null,
};
const bankDetails = {
  bankName: 'Example Bank',
  accountName: 'Example',
  accountNumber: '1234567890',
};
const accountFields = { name: 'Account', isControlAccount: false };
const paginated = {
  data: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
};
const dto = { id, name: 'Created resource', createdAt: new Date(timestamp) };

interface IToolCase {
  name: string;
  useCase: TUseCase;
  input: Record<string, unknown>;
  argument: unknown;
  result: unknown;
  expected: unknown;
}

const cases: IToolCase[] = [
  {
    name: 'create_counterparty',
    useCase: counterparty.createCounterpartyUseCase,
    input: { name: '  Supplier  ', type: 'organization', status: 'active' },
    argument: { name: 'Supplier', type: 'organization', status: 'active' },
    result: dto,
    expected: dto,
  },
  {
    name: 'get_counterparties',
    useCase: counterparty.getCounterpartiesUseCase,
    input: { roles: 'vendor', page: 2, limit: 5 },
    argument: { roles: ['vendor'], page: 2, limit: 5 },
    result: paginated,
    expected: paginated,
  },
  {
    name: 'get_counterparty',
    useCase: counterparty.getCounterpartyUseCase,
    input: { id },
    argument: id,
    result: dto,
    expected: dto,
  },
  {
    name: 'create_opening_balance',
    useCase: journal.createOpeningBalanceUseCase,
    input: { accountId: id, ...openingBalance },
    argument: {
      accountId: id,
      amount,
      exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
      date: new Date(timestamp),
    },
    result: undefined,
    expected: { success: true },
  },
  {
    name: 'create_payment',
    useCase: journal.createPaymentUseCase,
    input: { ...journalFields, sourceLine: line, destinationLines: [line] },
    argument: {
      ...journalFields,
      effectiveDate: new Date(timestamp),
      postedAt: new Date(timestamp),
      sourceLine: {
        ...line,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
      },
      destinationLines: [
        {
          ...line,
          exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
        },
      ],
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_receipt',
    useCase: journal.createReceiptUseCase,
    input: { ...journalFields, sourceLines: [line], destinationLine: line },
    argument: {
      ...journalFields,
      effectiveDate: new Date(timestamp),
      postedAt: new Date(timestamp),
      sourceLines: [
        {
          ...line,
          exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
        },
      ],
      destinationLine: {
        ...line,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
      },
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_transfer',
    useCase: journal.createTransferUseCase,
    input: {
      ...journalFields,
      sourceLine: transferLine,
      destinationLine: transferLine,
      chargeLines: [line],
    },
    argument: {
      ...journalFields,
      effectiveDate: new Date(timestamp),
      postedAt: new Date(timestamp),
      sourceLine: {
        ...transferLine,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
      },
      destinationLine: {
        ...transferLine,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
      },
      chargeLines: [
        {
          ...line,
          exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
        },
      ],
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'get_journal_entries',
    useCase: journal.getJournalEntriesUseCase,
    input: { accountId: id, page: 2, limit: 5 },
    argument: { accountId: id, page: 2, limit: 5 },
    result: paginated,
    expected: paginated,
  },
  {
    name: 'get_journal_entry',
    useCase: journal.getJournalEntryUseCase,
    input: { id },
    argument: id,
    result: dto,
    expected: dto,
  },
  {
    name: 'create_bank_account',
    useCase: ledger.createBankAccountUseCase,
    input: {
      name: 'Bank',
      currencyCode: 'NGN',
      bankAccount: bankDetails,
      openingBalance,
    },
    argument: {
      name: 'Bank',
      currencyCode: 'NGN',
      bankAccount: bankDetails,
      openingBalance: {
        amount,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
        date: new Date(timestamp),
      },
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_expense_account',
    useCase: ledger.createExpenseAccountUseCase,
    input: { ...accountFields, behavior: 'rent_and_utilities' },
    argument: { ...accountFields, behavior: 'rent_and_utilities' },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_petty_cash_account',
    useCase: ledger.createPettyCashAccountUseCase,
    input: { ...accountFields, currencyCode: 'NGN', openingBalance },
    argument: {
      ...accountFields,
      currencyCode: 'NGN',
      openingBalance: {
        amount,
        exchangeRate: { ...exchangeRate, asOf: new Date(timestamp) },
        date: new Date(timestamp),
      },
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_revenue_account',
    useCase: ledger.createRevenueAccountUseCase,
    input: { ...accountFields, behavior: 'services' },
    argument: { ...accountFields, behavior: 'services' },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_statutory_payable_account',
    useCase: ledger.createStatutoryPayableAccountUseCase,
    input: {
      ...accountFields,
      currencyCode: 'NGN',
      meta: { taxAuthority: 'Authority', taxType: 'VAT' },
    },
    argument: {
      ...accountFields,
      currencyCode: 'NGN',
      meta: { taxAuthority: 'Authority', taxType: 'VAT' },
    },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_statutory_receivable_account',
    useCase: ledger.createStatutoryReceivableAccountUseCase,
    input: { ...accountFields, currencyCode: 'NGN' },
    argument: { ...accountFields, currencyCode: 'NGN' },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_suspense_account',
    useCase: ledger.createSuspenseAccountUseCase,
    input: { name: 'Suspense', type: 'asset', currencyCode: 'NGN' },
    argument: { name: 'Suspense', type: 'asset', currencyCode: 'NGN' },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_trade_payable_account',
    useCase: ledger.createTradePayableAccountUseCase,
    input: { ...accountFields, meta: { counterpartyId: id, invoiceId: id } },
    argument: { ...accountFields, meta: { counterpartyId: id, invoiceId: id } },
    result: dto,
    expected: dto,
  },
  {
    name: 'create_trade_receivable_account',
    useCase: ledger.createTradeReceivableAccountUseCase,
    input: { ...accountFields, currencyCode: 'NGN' },
    argument: { ...accountFields, currencyCode: 'NGN' },
    result: dto,
    expected: dto,
  },
  {
    name: 'get_banks',
    useCase: ledger.getBanksUseCase,
    input: { countryCode: 'ng' },
    argument: { countryCode: 'NG' },
    result: [{ countryCode: 'NG', bankCode: '044', bankName: 'Example Bank' }],
    expected: {
      data: [{ countryCode: 'NG', bankCode: '044', bankName: 'Example Bank' }],
    },
  },
  {
    name: 'get_ledger_account',
    useCase: ledger.getLedgerAccountUseCase,
    input: { accountId: id },
    argument: id,
    result: dto,
    expected: dto,
  },
  {
    name: 'get_ledger_accounts',
    useCase: ledger.getLedgerAccountsUseCase,
    input: { type: 'asset', page: 2, limit: 5 },
    argument: { type: 'asset', page: 2, limit: 5 },
    result: paginated,
    expected: paginated,
  },
  {
    name: 'get_permitted_posting_accounts',
    useCase: ledger.getPermittedPostingAccountsUseCase,
    input: {
      sourceType: 'payment',
      side: 'source',
      currencyCode: 'NGN',
      page: 2,
      limit: 5,
    },
    argument: {
      sourceType: 'payment',
      side: 'source',
      currencyCode: 'NGN',
      page: 2,
      limit: 5,
    },
    result: paginated,
    expected: paginated,
  },
  {
    name: 'get_exchange_rates',
    useCase: money.getExchangeRateUseCase,
    input: { currencyPair: 'USD/NGN', type: 'official', asOf: timestamp },
    argument: {
      currencyPair: 'USD/NGN',
      type: 'official',
      asOf: new Date(timestamp),
    },
    result: [exchangeRate],
    expected: { data: [exchangeRate] },
  },
];

interface IRpcResponse {
  result: {
    tools: {
      name: string;
      annotations: { readOnlyHint: boolean };
      inputSchema: Record<string, unknown>;
    }[];
    isError?: boolean;
    structuredContent: unknown;
    content: { type: string; text: string }[];
  };
  error?: { code: number };
}

describe('MCP tool catalogue', () => {
  let handler: ReturnType<typeof createMcpHandler>;

  beforeEach(() => {
    jest.resetAllMocks();
    handler = createMcpHandler(() => createMcpServer({ version: 'test' }));
  });

  afterEach(async () => {
    await handler.close();
  });

  async function send(method: string, params?: object): Promise<IRpcResponse> {
    const response = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
    );
    const body = await response.text();
    const eventData = body
      .split('\n')
      .find((entry) => entry.startsWith('data: '));
    return JSON.parse(eventData ? eventData.slice(6) : body);
  }

  it('advertises exactly the requested tools with JSON schemas and accurate read hints', async () => {
    const response = await send('tools/list');
    expect(response.result.tools.map((tool) => tool.name).sort()).toEqual(
      cases.map((tool) => tool.name).sort()
    );
    expect(new Set(response.result.tools.map((tool) => tool.name)).size).toBe(
      23
    );
    for (const tool of response.result.tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.annotations.readOnlyHint).toBe(tool.name.startsWith('get_'));
    }
  });

  it.each(cases)(
    'dispatches $name once with its parsed input and serializes the result',
    async (tool) => {
      tool.useCase.mockResolvedValue(tool.result);
      const response = await send('tools/call', {
        name: tool.name,
        arguments: tool.input,
      });
      expect(response.result.isError).not.toBe(true);
      expect(tool.useCase).toHaveBeenCalledTimes(1);
      expect(tool.useCase).toHaveBeenCalledWith(tool.argument);
      expect(response.result.structuredContent).toEqual(
        JSON.parse(JSON.stringify(tool.expected))
      );
      expect(response.result.content).toEqual([
        { type: 'text', text: JSON.stringify(tool.expected) },
      ]);
    }
  );

  it.each(cases)(
    'returns only the public known error for $name',
    async (tool) => {
      tool.useCase.mockRejectedValue(
        new appError.BadRequest({ secret: 'private' })
      );
      const response = await send('tools/call', {
        name: tool.name,
        arguments: tool.input,
      });
      expect(response.result).toEqual({
        isError: true,
        content: [
          { type: 'text', text: '{"errorKey":"app_error_request_invalid"}' },
        ],
      });
      expect(mockReporter.report).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    'sanitizes and reports an unexpected $name failure once',
    async (tool) => {
      const error = new Error('private database details');
      tool.useCase.mockRejectedValue(error);
      const response = await send('tools/call', {
        name: tool.name,
        arguments: tool.input,
      });
      expect(response.result).toEqual({
        isError: true,
        content: [
          { type: 'text', text: '{"errorKey":"app_error_unexpected"}' },
        ],
      });
      expect(mockReporter.report).toHaveBeenCalledTimes(1);
      expect(mockReporter.report).toHaveBeenCalledWith(
        'mcp.tool.failed',
        error
      );
    }
  );

  it.each(cases)(
    'rejects malformed input before dispatching $name',
    async (tool) => {
      const invalid =
        tool.name === 'get_journal_entries' ||
        tool.name === 'get_ledger_accounts' ||
        tool.name === 'get_counterparties'
          ? { limit: 201 }
          : {};
      const response = await send('tools/call', {
        name: tool.name,
        arguments: invalid,
      });
      expect(response.result.isError).toBe(true);
      expect(tool.useCase).not.toHaveBeenCalled();
    }
  );

  it.each(['get_banks', 'get_exchange_rates'])(
    'wraps an empty $name result in an object',
    async (name) => {
      const tool = cases.find((entry) => entry.name === name)!;
      tool.useCase.mockResolvedValue([]);
      const response = await send('tools/call', {
        name,
        arguments: tool.input,
      });
      expect(response.result.structuredContent).toEqual({ data: [] });
    }
  );

  it.each(['create_bank_account', 'create_petty_cash_account'])(
    'retains currency validation for $name opening balances',
    async (name) => {
      const tool = cases.find((entry) => entry.name === name)!;
      const response = await send('tools/call', {
        name,
        arguments: {
          ...tool.input,
          openingBalance: {
            ...openingBalance,
            amount: { ...amount, currencyCode: 'USD' },
          },
        },
      });
      expect(response.result.isError).toBe(true);
      expect(tool.useCase).not.toHaveBeenCalled();
    }
  );

  it.each(['create_bank_account', 'create_petty_cash_account'])(
    'accepts a null $name opening balance',
    async (name) => {
      const tool = cases.find((entry) => entry.name === name)!;
      tool.useCase.mockResolvedValue(dto);
      const response = await send('tools/call', {
        name,
        arguments: { ...tool.input, openingBalance: null },
      });
      expect(response.result.isError).not.toBe(true);
      expect(tool.useCase).toHaveBeenCalledWith({
        ...(tool.argument as object),
        openingBalance: null,
      });
    }
  );

  it('rejects future opening-balance dates before dispatch', async () => {
    const response = await send('tools/call', {
      name: 'create_opening_balance',
      arguments: {
        accountId: id,
        ...openingBalance,
        date: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(response.result.isError).toBe(true);
    expect(journal.createOpeningBalanceUseCase).not.toHaveBeenCalled();
  });

  it.each(['create_payment', 'create_receipt', 'create_transfer'])(
    'rejects malformed $name dates before dispatch',
    async (name) => {
      const tool = cases.find((entry) => entry.name === name)!;
      const response = await send('tools/call', {
        name,
        arguments: { ...tool.input, effectiveDate: 'not-a-date' },
      });
      expect(response.result.isError).toBe(true);
      expect(tool.useCase).not.toHaveBeenCalled();
    }
  );

  it.each(['create_payment', 'create_receipt', 'create_transfer'])(
    'accepts unposted $name inputs without attachment references',
    async (name) => {
      const tool = cases.find((entry) => entry.name === name)!;
      tool.useCase.mockResolvedValue(dto);
      const response = await send('tools/call', {
        name,
        arguments: { ...tool.input, postedAt: null },
      });
      expect(response.result.isError).not.toBe(true);
      expect(tool.useCase).toHaveBeenCalledWith({
        ...(tool.argument as object),
        postedAt: null,
      });
    }
  );

  it('keeps exchange-rate asOf optional', async () => {
    money.getExchangeRateUseCase.mockResolvedValue([]);
    const response = await send('tools/call', {
      name: 'get_exchange_rates',
      arguments: { currencyPair: 'USD/NGN' },
    });
    expect(response.result.structuredContent).toEqual({ data: [] });
    expect(money.getExchangeRateUseCase).toHaveBeenCalledWith({
      currencyPair: 'USD/NGN',
    });
  });
});
