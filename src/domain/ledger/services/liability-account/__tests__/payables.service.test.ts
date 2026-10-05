import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
  IPayableAccount,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
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
const allocation: jest.Mocked<ILedgerCodeAllocationService> = {
  getNextCode: jest.fn(),
};

describe('payablesAccountService', () => {
  const service = makePayablesAccountService({
    ledgerAccountRepo,
    ledgerCodeAllocationService: allocation,
  });
  const createdBy = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: createdBy,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as IAccountingEntity;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  const makeControlAccount = (
    behavior: IPayableAccount['behavior'] = ELiabilityAccountBehavior.DefaultPayable,
    overrides: Partial<Pick<ILedgerAccount, 'currency'>> = {}
  ) =>
    ledgerAccountEntity.make<IPayableAccount>({
      name: 'Payables',
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      normalBalance: ENormalBalance.Credit,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: createdBy,
      ...overrides,
    })[0];
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  async function prepareStatutoryPayableSubAccount(
    payload: Omit<
      Parameters<typeof service.createStatutoryPayableSubAccount>[0],
      'controlAccountId'
    > & { controlAccount: ILedgerAccount }
  ) {
    const { controlAccount, ...facts } = payload;
    ledgerAccountRepo.findByCode.mockResolvedValue(controlAccount);
    ledgerAccountRepo.findById.mockResolvedValue(controlAccount);
    allocation.getNextCode.mockResolvedValue(
      String(Number(controlAccount.code) + 1).padStart(6, '0')
    );
    return service.createStatutoryPayableSubAccount(
      { ...facts, controlAccountId: controlAccount.id },
      { correlationId: 'creation-test', tx: {} }
    );
  }

  async function prepareTradePayableSubAccount(
    payload: Omit<
      Parameters<typeof service.createTradePayableSubAccount>[0],
      'controlAccountId'
    > & { controlAccount: ILedgerAccount }
  ) {
    const { controlAccount, ...facts } = payload;
    ledgerAccountRepo.findByCode.mockResolvedValue(controlAccount);
    ledgerAccountRepo.findById.mockResolvedValue(controlAccount);
    allocation.getNextCode.mockResolvedValue(
      String(Number(controlAccount.code) + 1).padStart(6, '0')
    );
    return service.createTradePayableSubAccount(
      { ...facts, controlAccountId: controlAccount.id },
      { correlationId: 'creation-test', tx: {} }
    );
  }

  afterEach(() => {
    expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  it('creates a payable header when one does not exist', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [account, events, audit] = await service.createHeader(
      {
        name: 'Payables',
        createdBy: createdBy,
        accountingEntity,
      },
      repoOptions
    );
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Payables',
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      type: ELedgerType.Liability,
      normalBalance: ENormalBalance.Credit,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.DefaultPayable,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: createdBy,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });
  it('rejects a duplicate payable header', async () => {
    const existingHeader = makeControlAccount();
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(existingHeader);
    await expect(
      service.createHeader(
        {
          name: 'Payables',
          createdBy: createdBy,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
      cause: { existingHeader },
    });
  });
  it('creates a statutory payable under a valid control account', async () => {
    const controlAccount = makeControlAccount();
    const [account, events, audit] = await prepareStatutoryPayableSubAccount({
      controlAccount,
      name: 'Personal Income Tax',
      createdBy: createdBy,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
      isControlAccount: false,
      meta: {
        taxAuthority: ' Federal Inland Revenue Service ',
        taxType: ' personal_income_tax ',
      },
    });
    expect(account).toMatchObject({
      code: LIABILITY_LEDGER_CODES.PAYABLES.TRADE,
      materializedPath: `${LIABILITY_LEDGER_CODES.PAYABLES.HEADER}.${LIABILITY_LEDGER_CODES.PAYABLES.TRADE}`,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: 'tax_payable',
      isControlAccount: false,
      controlAccountId: controlAccount.id,
      currency: SYSTEM_CURRENCIES.USD,
      meta: {
        taxAuthority: 'Federal Inland Revenue Service',
        taxType: 'personal_income_tax',
      },
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
    expect(Object.isFrozen(account.meta)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });
  it('creates a trade payable after the latest payable', async () => {
    const controlAccount = makeControlAccount(
      ELiabilityAccountBehavior.TradePayable
    );
    const counterpartyId = generateUUID();
    const invoiceId = generateUUID();
    const [account] = await prepareTradePayableSubAccount({
      controlAccount,
      name: 'Supplier Invoice',
      createdBy: createdBy,
      accountingEntity,
      isControlAccount: false,
      meta: { counterpartyId, invoiceId },
    });
    expect(account).toMatchObject({
      code: '201001',
      materializedPath: `${LIABILITY_LEDGER_CODES.PAYABLES.HEADER}.201001`,
      behavior: ELiabilityAccountBehavior.TradePayable,
      controlAccountId: controlAccount.id,
      currency: null,
      meta: { counterpartyId, invoiceId },
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    });
    expect(Object.isFrozen(account.meta)).toBe(true);
  });
  it('rejects a payable control account from another accounting entity', async () => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      accountingEntityId: generateUUID(),
    };
    await expect(
      prepareTradePayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Supplier Invoice',
        createdBy: createdBy,
        accountingEntity,
        isControlAccount: false,
        meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
      })
    ).rejects.toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });
  it('creates a null-currency trade payable under a null-currency trade control', async () => {
    const controlAccount = makeControlAccount(
      ELiabilityAccountBehavior.TradePayable,
      { currency: null }
    );
    const [account] = await prepareTradePayableSubAccount({
      controlAccount,
      name: 'Nested Trade Payable',
      createdBy: createdBy,
      accountingEntity,
      isControlAccount: false,
      meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
    });
    expect(account.controlAccountId).toBe(controlAccount.id);
    expect(account.currency).toBeNull();
  });
  it.each([
    { type: ELedgerType.Asset },
    { subType: ELiabilitySubType.Suspense },
    { isControlAccount: false },
    { behavior: ELiabilityAccountBehavior.TradePayable },
    { currency: null },
  ])('rejects an invalid statutory control account: %o', async (change) => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      ...change,
    };
    await expect(
      prepareStatutoryPayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Tax Payable',
        createdBy: createdBy,
        accountingEntity,
        currency: SYSTEM_CURRENCIES.USD,
        isControlAccount: false,
        meta: { taxAuthority: 'FIRS', taxType: 'VAT' },
      })
    ).rejects.toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });
  it.each([
    { type: ELedgerType.Asset },
    { subType: ELiabilitySubType.Suspense },
    { isControlAccount: false },
    { behavior: 'tax_payable' },
  ])('rejects an invalid trade control account: %o', async (change) => {
    const suppliedControlAccount = {
      ...makeControlAccount(),
      ...change,
    };
    await expect(
      prepareTradePayableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Supplier Invoice',
        createdBy: createdBy,
        accountingEntity,
        isControlAccount: false,
        meta: { counterpartyId: generateUUID(), invoiceId: generateUUID() },
      })
    ).rejects.toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
  });
  it('creates trade and statutory control accounts with null metadata', async () => {
    const controlAccount = makeControlAccount();
    const payload = {
      controlAccount,
      createdBy,
      accountingEntity,
      isControlAccount: true,
      meta: null,
    };
    const [trade, tradeEvents, tradeAudit] =
      await prepareTradePayableSubAccount({
        ...payload,
        name: 'Trade Payables',
      });
    const [statutory, statutoryEvents, statutoryAudit] =
      await prepareStatutoryPayableSubAccount({
        ...payload,
        name: 'Statutory Payables',
        currency: SYSTEM_CURRENCIES.USD,
      });
    expect(trade).toMatchObject({
      isControlAccount: true,
      controlAccountId: controlAccount.id,
      meta: null,
      currency: null,
    });
    expect(statutory).toMatchObject({
      isControlAccount: true,
      controlAccountId: controlAccount.id,
      meta: null,
      currency: SYSTEM_CURRENCIES.USD,
    });
    expect(tradeEvents[0].data).toEqual(trade);
    expect(statutoryEvents[0].data).toEqual(statutory);
    expect(tradeAudit.entityId).toBe(trade.id);
    expect(statutoryAudit.entityId).toBe(statutory.id);
    expect(Object.isFrozen(trade)).toBe(true);
    expect(Object.isFrozen(statutory)).toBe(true);
  });
  it('returns an immutable service', async () => {
    expect(Object.isFrozen(service)).toBe(true);
  });
  describe('createStatutoryPayableSubAccount protected creation', () => {
    const createdBy = generateUUID();
    const accountingEntity = {
      id: generateUUID(),
      createdBy,
      ownerId: createdBy,
      functionalCurrencyCode: 'USD',
    } as IAccountingEntity;
    const options = { correlationId: 'protected-creation', tx: {} };
    let header: ILedgerAccount;
    const payload: Parameters<
      typeof service.createStatutoryPayableSubAccount
    >[0] = {
      name: 'Final account',
      meta: null,
      createdBy,
      isControlAccount: false,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
    };
    beforeEach(async () => {
      ledgerAccountRepo.findByCode.mockReset().mockResolvedValue(null);
      header = (
        await service.createHeader(
          { name: 'Root account', accountingEntity, createdBy },
          options
        )
      )[0];
      jest.clearAllMocks();
      ledgerAccountRepo.findByCode.mockResolvedValue(header);
      ledgerAccountRepo.findById.mockResolvedValue(header);
      allocation.getNextCode
        .mockReset()
        .mockResolvedValue(header.code.slice(0, 3) + '042');
    });
    it.each([true, false])(
      'rejects an archived parent with explicit selection %s before allocating a code',
      async (explicit) => {
        const [archivedParent] = ledgerAccountEntity.archive(header);
        ledgerAccountRepo.findByCode.mockResolvedValue(
          explicit ? header : archivedParent
        );
        ledgerAccountRepo.findById.mockResolvedValue(archivedParent);

        await expect(
          service.createStatutoryPayableSubAccount(
            {
              ...payload,
              controlAccountId: explicit ? archivedParent.id : undefined,
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
        expect(allocation.getNextCode).not.toHaveBeenCalled();
      }
    );

    it.each([
      undefined,
      ELedgerAccountStatus.Active,
      ELedgerAccountStatus.Draft,
    ])(
      'creates complete account, event, and audit state with status %s',
      async (status) => {
        const [account, events, audit] =
          await service.createStatutoryPayableSubAccount(
            { ...payload, status },
            options
          );
        expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
          LIABILITY_LEDGER_CODES.PAYABLES.STATUTORY,
          accountingEntity.id,
          { ...options, lock: 'update' }
        );
        expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
        expect(account).toMatchObject({
          code: header.code.slice(0, 3) + '042',
          materializedPath:
            header.materializedPath + '.' + header.code.slice(0, 3) + '042',
          controlAccountId: header.id,
          version: 1,
        });
        expect(account.status).toBe(status ?? ELedgerAccountStatus.Active);
        expect(account.currency).toBe(SYSTEM_CURRENCIES.USD);
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual(account);
        expect(audit.diff).toMatchObject({ before: null, after: account });
        expect(Object.isFrozen(account)).toBe(true);
        expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
        expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
      }
    );
    it('locks the common root before a nested explicit parent and keeps the selected path', async () => {
      const parent = ledgerAccountEntity.make<ILedgerAccount>({
        ...header,
        name: 'Nested parent',
        code: header.code.slice(0, 3) + '037',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '037',
        controlAccountId: header.id,
        currency: SYSTEM_CURRENCIES.USD,
      })[0];
      ledgerAccountRepo.findById.mockResolvedValue(parent);
      const [account] = await service.createStatutoryPayableSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(ledgerAccountRepo.findById).toHaveBeenCalledWith(
        parent.id,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(
        ledgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(ledgerAccountRepo.findById.mock.invocationCallOrder[0]);
      expect(
        ledgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(allocation.getNextCode.mock.invocationCallOrder[0]);
      expect(account.materializedPath).toBe(
        parent.materializedPath + '.' + account.code
      );
      expect(account.code).toBe(header.code.slice(0, 3) + '042');
    });
    it('rejects missing transaction context before any reads', async () => {
      await expect(
        service.createStatutoryPayableSubAccount(payload, {
          correlationId: 'missing',
          tx: undefined,
        } as unknown as typeof options)
      ).rejects.toBeInstanceOf(
        ledgerAccountError.CodeAllocationTransactionRequired
      );
      expect(ledgerAccountRepo.findByCode).not.toHaveBeenCalled();
    });
    it('rejects a missing allocation root before parent resolution', async () => {
      ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
      await expect(
        service.createStatutoryPayableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      ledgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createStatutoryPayableSubAccount(
          { ...payload, controlAccountId: createdBy },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('propagates allocation failure without creating or storing state', async () => {
      const failure = new ledgerAccountError.MaximumLimitReached();
      allocation.getNextCode.mockRejectedValueOnce(failure);
      await expect(
        service.createStatutoryPayableSubAccount(payload, options)
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('preserves a missing nested default as a configuration error', async () => {
      ledgerAccountRepo.findByCode
        .mockResolvedValueOnce(header)
        .mockResolvedValueOnce(null);
      await expect(
        service.createStatutoryPayableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
  });

  describe('createTradePayableSubAccount protected creation', () => {
    const createdBy = generateUUID();
    const accountingEntity = {
      id: generateUUID(),
      createdBy,
      ownerId: createdBy,
      functionalCurrencyCode: 'USD',
    } as IAccountingEntity;
    const options = { correlationId: 'protected-creation', tx: {} };
    let header: ILedgerAccount;
    const payload: Parameters<typeof service.createTradePayableSubAccount>[0] =
      {
        name: 'Final account',
        meta: null,
        createdBy,
        isControlAccount: false,
        accountingEntity,
      };
    beforeEach(async () => {
      ledgerAccountRepo.findByCode.mockReset().mockResolvedValue(null);
      header = (
        await service.createHeader(
          { name: 'Root account', accountingEntity, createdBy },
          options
        )
      )[0];
      jest.clearAllMocks();
      ledgerAccountRepo.findByCode.mockResolvedValue(header);
      ledgerAccountRepo.findById.mockResolvedValue(header);
      allocation.getNextCode
        .mockReset()
        .mockResolvedValue(header.code.slice(0, 3) + '042');
    });
    it.each([true, false])(
      'rejects an archived parent with explicit selection %s before allocating a code',
      async (explicit) => {
        const [archivedParent] = ledgerAccountEntity.archive(header);
        ledgerAccountRepo.findByCode.mockResolvedValue(
          explicit ? header : archivedParent
        );
        ledgerAccountRepo.findById.mockResolvedValue(archivedParent);

        await expect(
          service.createTradePayableSubAccount(
            {
              ...payload,
              controlAccountId: explicit ? archivedParent.id : undefined,
            },
            options
          )
        ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
        expect(allocation.getNextCode).not.toHaveBeenCalled();
      }
    );

    it.each([
      undefined,
      ELedgerAccountStatus.Active,
      ELedgerAccountStatus.Draft,
    ])(
      'creates complete account, event, and audit state with status %s',
      async (status) => {
        const [account, events, audit] =
          await service.createTradePayableSubAccount(
            { ...payload, status },
            options
          );
        expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
          LIABILITY_LEDGER_CODES.PAYABLES.TRADE,
          accountingEntity.id,
          { ...options, lock: 'update' }
        );
        expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
        expect(account).toMatchObject({
          code: header.code.slice(0, 3) + '042',
          materializedPath:
            header.materializedPath + '.' + header.code.slice(0, 3) + '042',
          controlAccountId: header.id,
          version: 1,
        });
        expect(account.status).toBe(status ?? ELedgerAccountStatus.Active);
        expect(account.currency).toBe(null);
        expect(events).toHaveLength(1);
        expect(events[0].data).toEqual(account);
        expect(audit.diff).toMatchObject({ before: null, after: account });
        expect(Object.isFrozen(account)).toBe(true);
        expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
        expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
      }
    );
    it('locks the common root before a nested explicit parent and keeps the selected path', async () => {
      const parent = ledgerAccountEntity.make<ILedgerAccount>({
        ...header,
        name: 'Nested parent',
        code: header.code.slice(0, 3) + '037',
        materializedPath:
          header.materializedPath + '.' + header.code.slice(0, 3) + '037',
        controlAccountId: header.id,
        currency: null,
      })[0];
      ledgerAccountRepo.findById.mockResolvedValue(parent);
      const [account] = await service.createTradePayableSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(ledgerAccountRepo.findById).toHaveBeenCalledWith(
        parent.id,
        accountingEntity.id,
        { ...options, lock: 'update' }
      );
      expect(
        ledgerAccountRepo.findByCode.mock.invocationCallOrder[0]
      ).toBeLessThan(ledgerAccountRepo.findById.mock.invocationCallOrder[0]);
      expect(
        ledgerAccountRepo.findById.mock.invocationCallOrder[0]
      ).toBeLessThan(allocation.getNextCode.mock.invocationCallOrder[0]);
      expect(account.materializedPath).toBe(
        parent.materializedPath + '.' + account.code
      );
      expect(account.code).toBe(header.code.slice(0, 3) + '042');
    });
    it('rejects missing transaction context before any reads', async () => {
      await expect(
        service.createTradePayableSubAccount(payload, {
          correlationId: 'missing',
          tx: undefined,
        } as unknown as typeof options)
      ).rejects.toBeInstanceOf(
        ledgerAccountError.CodeAllocationTransactionRequired
      );
      expect(ledgerAccountRepo.findByCode).not.toHaveBeenCalled();
    });
    it('rejects a missing allocation root before parent resolution', async () => {
      ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
      await expect(
        service.createTradePayableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      ledgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createTradePayableSubAccount(
          { ...payload, controlAccountId: createdBy },
          options
        )
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('propagates allocation failure without creating or storing state', async () => {
      const failure = new ledgerAccountError.MaximumLimitReached();
      allocation.getNextCode.mockRejectedValueOnce(failure);
      await expect(
        service.createTradePayableSubAccount(payload, options)
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('preserves a missing nested default as a configuration error', async () => {
      ledgerAccountRepo.findByCode
        .mockResolvedValueOnce(header)
        .mockResolvedValueOnce(null);
      await expect(
        service.createTradePayableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
  });
});
