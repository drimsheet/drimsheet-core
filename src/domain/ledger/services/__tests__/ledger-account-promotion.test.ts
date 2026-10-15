import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makebank from '@domain/ledger/services/asset-account/cash-account.service';
import makecash from '@domain/ledger/services/asset-account/cash-account.service';
import maketradeReceivable from '@domain/ledger/services/asset-account/receivables-account.service';
import maketaxReceivable from '@domain/ledger/services/asset-account/receivables-account.service';
import makedisposal from '@domain/ledger/services/expense-account/asset-disposal-loss.service';
import makebankCharge from '@domain/ledger/services/expense-account/bank-charge.service';
import makedirect from '@domain/ledger/services/expense-account/direct-costs.service';
import makefinance from '@domain/ledger/services/expense-account/finance-cost.service';
import makeinterest from '@domain/ledger/services/expense-account/interest.service';
import makerent from '@domain/ledger/services/expense-account/rent-and-utilities.service';
import maketax from '@domain/ledger/services/expense-account/tax-expense.service';
import makeloss from '@domain/ledger/services/expense-account/unrealized-loss.service';
import makeLedgerAccountService from '@domain/ledger/services/ledger-account.service';
import maketradePayable from '@domain/ledger/services/liability-account/payables.service';
import maketaxPayable from '@domain/ledger/services/liability-account/payables.service';
import makeemployment from '@domain/ledger/services/revenue-account/employment-income.service';
import makesale from '@domain/ledger/services/revenue-account/gain-on-sale.service';
import makegifts from '@domain/ledger/services/revenue-account/gifts.service';
import makegrants from '@domain/ledger/services/revenue-account/grants.service';
import makeservices from '@domain/ledger/services/revenue-account/services.service';
import makegains from '@domain/ledger/services/revenue-account/unrealized-gain.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  delete: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findDescendants: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};
const ledgerAccountBalanceRepo: jest.Mocked<ILedgerAccountBalanceRepo> = {
  findAllByAccountingEntityId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  adjustBalance: jest.fn(),
  findByAccountId: jest.fn(),
  findAdjustmentsByAccountId: jest.fn(),
  createWithAdjustments: jest.fn(),
  findAllByAccountIds: jest.fn(),
};
const journalEntryRepo: jest.Mocked<IJournalEntryRepo> = {
  existsByAccountingEntityId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  existsByAccountId: jest.fn(),
  existsPostedByAccountId: jest.fn(),
  findAllByAccountIds: jest.fn(),
};
const bankAccountRepo: jest.Mocked<IBankAccountRepo> = {
  findOne: jest.fn(),
  findByLedgerAccountId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const allocation = makeLedgerAccountService({
  ledgerAccountRepo,
  ledgerAccountBalanceRepo,
  journalEntryRepo,
});
const ledgerAccountService = {
  ...allocation,
  promotePostingToControlAccount: jest.fn(
    allocation.promotePostingToControlAccount
  ),
  getNextCode: jest.fn(allocation.getNextCode),
};
const deps = { ledgerAccountRepo, ledgerAccountService, bankAccountRepo };
const createdBy = generateUUID();
const [accountingEntity] = accountingEntityEntity.make({
  createdBy,
  ownerId: generateUUID(),
  name: 'Promotion books',
  type: 'individual',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const repoOptions = { tx: {}, correlationId: 'promotion' };
const families = [
  {
    name: 'services',
    header: makeservices(deps).createHeader,
    create: makeservices(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'employment',
    header: makeemployment(deps).createHeader,
    create: makeemployment(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'sale',
    header: makesale(deps).createHeader,
    create: makesale(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'gains',
    header: makegains(deps).createHeader,
    create: makegains(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'grants',
    header: makegrants(deps).createHeader,
    create: makegrants(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'gifts',
    header: makegifts(deps).createHeader,
    create: makegifts(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'direct',
    header: makedirect(deps).createHeader,
    create: makedirect(deps).createSubAccount,
    behavior: 'default_direct_cost',
  },
  {
    name: 'rent',
    header: makerent(deps).createHeader,
    create: makerent(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'bankCharge',
    header: makebankCharge(deps).createHeader,
    create: makebankCharge(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'finance',
    header: makefinance(deps).createHeader,
    create: makefinance(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'interest',
    header: makeinterest(deps).createHeader,
    create: makeinterest(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'tax',
    header: maketax(deps).createHeader,
    create: maketax(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'loss',
    header: makeloss(deps).createHeader,
    create: makeloss(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'disposal',
    header: makedisposal(deps).createHeader,
    create: makedisposal(deps).createSubAccount,
    behavior: undefined,
  },
  {
    name: 'bank',
    header: makebank(deps).createHeader,
    create: makebank(deps).createBankSubAccount,
    behavior: 'bank',
  },
  {
    name: 'cash',
    header: makecash(deps).createHeader,
    create: makecash(deps).createPettyCashSubAccount,
    behavior: 'petty_cash',
  },
  {
    name: 'tradeReceivable',
    header: maketradeReceivable(deps).createHeader,
    create: maketradeReceivable(deps).createTradeReceivableSubAccount,
    behavior: 'trade_receivable',
  },
  {
    name: 'taxReceivable',
    header: maketaxReceivable(deps).createHeader,
    create: maketaxReceivable(deps).createStatutoryReceivableSubAccount,
    behavior: 'statutory_receivable',
  },
  {
    name: 'tradePayable',
    header: maketradePayable(deps).createHeader,
    create: maketradePayable(deps).createTradePayableSubAccount,
    behavior: 'trade_payable',
  },
  {
    name: 'taxPayable',
    header: maketaxPayable(deps).createHeader,
    create: maketaxPayable(deps).createStatutoryPayableSubAccount,
    behavior: 'tax_payable',
  },
];

beforeEach(() => {
  jest.resetAllMocks();
  ledgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue([]);
  ledgerAccountService.promotePostingToControlAccount.mockImplementation(
    allocation.promotePostingToControlAccount
  );
  ledgerAccountService.getNextCode.mockImplementation(allocation.getNextCode);
});

async function prepare(family: (typeof families)[number]) {
  const [header] = await family.header(
    { name: 'Family', accountingEntity, createdBy },
    repoOptions
  );
  const currency =
    header.type === 'revenue' ||
    header.type === 'expense' ||
    family.behavior === 'trade_payable'
      ? null
      : SYSTEM_CURRENCIES.NGN;
  const code = `${header.code.slice(0, 3)}001`;
  const [posting] = ledgerAccountEntity.make({
    ...header,
    name: 'Original',
    code,
    materializedPath: `${header.materializedPath}.${code}`,
    isControlAccount: false,
    controlAccountId: header.id,
    behavior: family.behavior ?? header.behavior,
    currency,
  });
  const zero = ledgerAccountBalanceEntity.make({
    createdBy,
    ledgerAccountId: posting.id,
    accountingEntityId: accountingEntity.id,
    accountMaterializedPath: posting.materializedPath,
    currencyCode: 'NGN',
    functionalCurrencyCode: 'NGN',
  });
  const balance = ledgerAccountBalanceEntity.adjust(zero, {
    createdBy,
    ledgerAccountId: posting.id,
    journalEntryId: generateUUID(),
    amount: moneyValue.make(15000n, SYSTEM_CURRENCIES.NGN, true),
    functionalAmount: moneyValue.make(15000n, SYSTEM_CURRENCIES.NGN, true),
  }).newBalance;
  ledgerAccountRepo.findByCode.mockResolvedValue(header);
  ledgerAccountRepo.findById.mockResolvedValue(posting);
  ledgerAccountRepo.findLatestBySubType.mockResolvedValue(posting);
  ledgerAccountBalanceRepo.findByAccountId.mockResolvedValue(balance);
  return {
    posting,
    header,
    balance,
    payload: {
      name: 'Requested child',
      createdBy,
      accountingEntity,
      accountingEntityId: accountingEntity.id,
      isControlAccount: false,
      controlAccountId: posting.id,
      currency: SYSTEM_CURRENCIES.NGN,
      meta: null,
      behavior: 'default_direct_cost' as const,
      bankDetails: {
        countryCode: 'NG',
        bankName: 'Test Bank',
        accountName: 'New account',
        accountNumber: '1234567890',
      },
    },
  };
}

it.each([false, true])(
  'prepares control adjustment history without persisting it, empty=%s',
  async (empty) => {
    const { posting, balance } = await prepare(families[0]);
    const adjustments = empty
      ? []
      : [15000n, -5000n, 0n].map(
          (amount) =>
            ledgerAccountBalanceEntity.adjust(balance, {
              createdBy,
              ledgerAccountId: posting.id,
              journalEntryId: generateUUID(),
              amount: moneyValue.make(amount, balance.amount.currency, true),
              functionalAmount: moneyValue.make(
                amount,
                balance.functionalAmount.currency,
                true
              ),
            }).adjustment
        );
    const originalHistory = structuredClone(adjustments);
    ledgerAccountBalanceRepo.findAdjustmentsByAccountId.mockResolvedValue(
      adjustments
    );

    const promotion = await allocation.promotePostingToControlAccount(
      posting,
      createdBy,
      repoOptions
    );
    const [control] = promotion.controlAccount;

    expect(
      ledgerAccountBalanceRepo.findAdjustmentsByAccountId
    ).toHaveBeenCalledWith(posting.id, repoOptions);
    expect(promotion.controlAdjustments).toHaveLength(adjustments.length);
    promotion.controlAdjustments.forEach((cloned, index) => {
      expect(cloned).toEqual({
        ...originalHistory[index],
        id: expect.any(String),
        ledgerAccountId: control.id,
      });
      expect(cloned.id).not.toBe(adjustments[index].id);
    });
    expect(adjustments).toEqual(originalHistory);
    expect(promotion.controlBalance.amount).toEqual(balance.amount);
    expect(promotion.postingBalance.amount).toEqual(balance.amount);
    expect(ledgerAccountBalanceRepo.create).not.toHaveBeenCalled();
    expect(
      ledgerAccountBalanceRepo.createWithAdjustments
    ).not.toHaveBeenCalled();
    expect(ledgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
  }
);

it.each(families)(
  'promotes $name before child allocation and preserves posting identity and balances',
  async (family) => {
    const { posting, header, balance, payload } = await prepare(family);
    const [child, , , promotion] = await family.create(payload, repoOptions);
    expect(promotion).toBeDefined();
    const [control, controlEvents, controlAudit] = promotion!.controlAccount;
    const [reassigned, postingEvents, postingAudit] = promotion!.postingAccount;
    const prefix = header.code.slice(0, 3);
    expect(control).toMatchObject({
      code: posting.code,
      materializedPath: posting.materializedPath,
      name: 'Original',
      isControlAccount: true,
      controlAccountId: header.id,
      openingBalanceDate: null,
      meta: null,
    });
    expect(control.id).not.toBe(posting.id);
    expect(reassigned).toMatchObject({
      id: posting.id,
      code: `${prefix}002`,
      materializedPath: `${posting.materializedPath}.${prefix}002`,
      name: 'Original',
      controlAccountId: control.id,
      isControlAccount: false,
      version: posting.version + 1,
      createdAt: posting.createdAt,
      createdBy: posting.createdBy,
    });
    expect(child).toMatchObject({
      code: `${prefix}003`,
      controlAccountId: control.id,
      materializedPath: `${posting.materializedPath}.${prefix}003`,
    });
    expect(promotion!.controlBalance).toMatchObject({
      ledgerAccountId: control.id,
      amount: balance.amount,
      functionalAmount: balance.functionalAmount,
      accountMaterializedPath: control.materializedPath,
      version: 1,
    });
    expect(promotion!.postingBalance).toMatchObject({
      ledgerAccountId: posting.id,
      amount: balance.amount,
      functionalAmount: balance.functionalAmount,
      accountMaterializedPath: reassigned.materializedPath,
      version: balance.version + 1,
    });
    expect(controlEvents).toHaveLength(1);
    expect(postingEvents).toHaveLength(1);
    expect(controlAudit.action).toBe('created');
    expect(postingAudit?.diff.after).toMatchObject({
      code: reassigned.code,
      controlAccountId: control.id,
    });
    expect(Object.isFrozen(reassigned)).toBe(true);
    expect(Object.isFrozen(promotion!.postingBalance)).toBe(true);
    expect(posting.code).toBe(`${prefix}001`);
    expect(
      ledgerAccountService.promotePostingToControlAccount.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      ledgerAccountService.getNextCode.mock.invocationCallOrder[0]
    );
    expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
    expect(journalEntryRepo.update).not.toHaveBeenCalled();
    expect(journalEntryRepo.existsByAccountId).not.toHaveBeenCalled();
  }
);

it.each(families)(
  'uses client-localized promotion names for $name without renaming the requested child',
  async (family) => {
    const { posting, payload } = await prepare(family);
    const promotionNames = {
      newControlAccountName: 'إيرادات الاستشارات',
      newPostingAccountName: 'Conseil (par défaut)',
    };
    const [child, , , promotion] = await family.create(
      { ...payload, promotionNames },
      repoOptions
    );
    const [control, controlEvents, controlAudit] = promotion!.controlAccount;
    const [reassigned, postingEvents, postingAudit] = promotion!.postingAccount;

    expect(control.name).toBe(promotionNames.newControlAccountName);
    expect(reassigned.name).toBe(promotionNames.newPostingAccountName);
    expect(child.name).toBe(payload.name);
    expect(posting.name).toBe('Original');
    expect(controlEvents[0].data.name).toBe(control.name);
    expect(postingEvents[0].data.name).toBe(reassigned.name);
    expect(controlAudit.diff.after).toMatchObject({ name: control.name });
    expect(postingAudit?.diff.before).toMatchObject({ name: 'Original' });
    expect(postingAudit?.diff.after).toMatchObject({ name: reassigned.name });
  }
);

it.each(families)(
  'ignores promotion names for $name when the selected parent is already a control',
  async (family) => {
    const { header, payload } = await prepare(family);
    ledgerAccountRepo.findById.mockResolvedValue(header);
    const [child, , , promotion] = await family.create(
      {
        ...payload,
        controlAccountId: header.id,
        promotionNames: {
          newControlAccountName: 'Another group',
          newPostingAccountName: 'Another posting account',
        },
      },
      repoOptions
    );

    expect(promotion).toBeUndefined();
    expect(
      ledgerAccountService.promotePostingToControlAccount
    ).not.toHaveBeenCalled();
    expect(child.name).toBe(payload.name);
    expect(child.controlAccountId).toBe(header.id);
    expect(header.name).toBe('Family');
  }
);

it.each(['', 'x', '   ', 'x'.repeat(101)])(
  'rejects invalid promotion names in the domain: %j',
  async (invalidName) => {
    const { payload } = await prepare(families[0]);
    for (const field of ['newControlAccountName', 'newPostingAccountName']) {
      await expect(
        families[0].create(
          {
            ...payload,
            promotionNames: {
              newControlAccountName: 'Conseil',
              newPostingAccountName: 'Conseil (par défaut)',
              [field]: invalidName,
            },
          },
          repoOptions
        )
      ).rejects.toThrow(ledgerAccountError.InvalidName);
    }
    expect(ledgerAccountService.getNextCode).not.toHaveBeenCalled();
    expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
  }
);

it.each(families)(
  'validates the selected $name posting account before cloning or allocating codes',
  async (family) => {
    const { posting, payload } = await prepare(family);
    ledgerAccountRepo.findById.mockResolvedValue({
      ...posting,
      subType: 'invalid',
    });

    await expect(family.create(payload, repoOptions)).rejects.toThrow(
      ledgerAccountError.InvalidControlAccount
    );
    expect(
      ledgerAccountService.promotePostingToControlAccount
    ).not.toHaveBeenCalled();
    expect(ledgerAccountService.getNextCode).not.toHaveBeenCalled();
    expect(ledgerAccountBalanceRepo.findByAccountId).not.toHaveBeenCalled();
  }
);

it.each<Partial<ILedgerAccount>>([
  { status: 'draft' },
  { currency: SYSTEM_CURRENCIES.USD },
  { accountingEntityId: generateUUID() },
])(
  'rejects an ineligible posting parent before cloning: %o',
  async (change) => {
    const { posting, payload } = await prepare(families[0]);
    ledgerAccountRepo.findById.mockResolvedValue({ ...posting, ...change });

    await expect(families[0].create(payload, repoOptions)).rejects.toThrow();
    expect(
      ledgerAccountService.promotePostingToControlAccount
    ).not.toHaveBeenCalled();
    expect(ledgerAccountService.getNextCode).not.toHaveBeenCalled();
  }
);

it('rejects promotion without a transaction, an archived parent, a root, or an existing control', async () => {
  const { posting, header } = await prepare(families[0]);
  await expect(
    allocation.promotePostingToControlAccount(posting, createdBy, {
      ...repoOptions,
      tx: undefined!,
    })
  ).rejects.toThrow(ledgerAccountError.CodeAllocationTransactionRequired);
  await expect(
    allocation.promotePostingToControlAccount(header, createdBy, repoOptions)
  ).rejects.toThrow(ledgerAccountError.InvalidControlAccount);
  await expect(
    allocation.promotePostingToControlAccount(
      { ...posting, controlAccountId: null },
      createdBy,
      repoOptions
    )
  ).rejects.toThrow(ledgerAccountError.InvalidControlAccount);
  await expect(
    allocation.promotePostingToControlAccount(
      { ...posting, status: 'archived' },
      createdBy,
      repoOptions
    )
  ).rejects.toThrow();
});

it('fails before child allocation when the existing balance is missing', async () => {
  const { payload } = await prepare(families[0]);
  ledgerAccountBalanceRepo.findByAccountId.mockResolvedValue(null);
  await expect(families[0].create(payload, repoOptions)).rejects.toThrow(
    ledgerAccountError.PromotionBalanceNotFound
  );
  expect(ledgerAccountService.getNextCode).not.toHaveBeenCalled();
});

it.each(['401998', '401999'])(
  'rejects insufficient family capacity at %s without persistence',
  async (code) => {
    const { posting, payload } = await prepare(families[0]);
    ledgerAccountRepo.findLatestBySubType.mockResolvedValue({
      ...posting,
      code,
    });
    await expect(families[0].create(payload, repoOptions)).rejects.toThrow(
      ledgerAccountError.MaximumLimitReached
    );
    expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
  }
);

it('preserves opening dates and metadata, preserves the full original name, and handles an absent latest lookup', async () => {
  const { posting } = await prepare(families[0]);
  ledgerAccountRepo.findLatestBySubType.mockResolvedValue(null);
  const original: ILedgerAccount = {
    ...posting,
    name: 'A'.repeat(100),
    meta: { source: 'original' },
    openingBalanceDate: new Date('2020-01-01'),
  };
  const promotion = await allocation.promotePostingToControlAccount(
    original,
    createdBy,
    repoOptions
  );
  expect(promotion.postingAccount[0]).toMatchObject({
    id: original.id,
    code: '401002',
    meta: original.meta,
    openingBalanceDate: original.openingBalanceDate,
    name: original.name,
  });
});
