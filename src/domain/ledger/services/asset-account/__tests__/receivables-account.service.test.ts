import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import makeReceivablesAccountService from '@domain/ledger/services/asset-account/receivables-account.service';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

const ledgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAllByIds: jest.fn(),
  findAllByMaterializedPath: jest.fn(),
  findByCode: jest.fn(),
  findBySubType: jest.fn(),
  findByBehavior: jest.fn(),
  findLatestBySubType: jest.fn(),
  findAll: jest.fn(),
};
const allocation: jest.Mocked<ILedgerCodeAllocationService> = {
  getNextCode: jest.fn(),
};

describe('receivablesAccountService', () => {
  const service = makeReceivablesAccountService({
    ledgerAccountRepo,
    ledgerCodeAllocationService: allocation,
  });
  const userId = generateUUID();
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    ownerId: userId,
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
  } as IAccountingEntity;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  const receivablesHeader = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
    code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
    materializedPath: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
    accountingEntityId: accountingEntity.id,
    type: ELedgerType.Asset,
    subType: EAssetSubType.Receivables,
    behavior: EAssetAccountBehavior.DefaultReceivables,
    isControlAccount: true,
    controlAccountId: null,
    currency: SYSTEM_CURRENCIES.USD,
  } as ILedgerAccount;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    jest.clearAllMocks();
  });

  async function prepareTradeReceivableSubAccount(
    payload: Omit<
      Parameters<typeof service.createTradeReceivableSubAccount>[0],
      'controlAccountId'
    > & { controlAccount: ILedgerAccount }
  ) {
    const { controlAccount, ...facts } = payload;
    ledgerAccountRepo.findByCode.mockResolvedValue(controlAccount);
    ledgerAccountRepo.findById.mockResolvedValue(controlAccount);
    allocation.getNextCode.mockResolvedValue(
      String(Number(controlAccount.code) + 1).padStart(6, '0')
    );
    return service.createTradeReceivableSubAccount(
      { ...facts, controlAccountId: controlAccount.id },
      { correlationId: 'creation-test', tx: {} }
    );
  }

  async function prepareStatutoryReceivableSubAccount(
    payload: Omit<
      Parameters<typeof service.createStatutoryReceivableSubAccount>[0],
      'controlAccountId'
    > & { controlAccount: ILedgerAccount }
  ) {
    const { controlAccount, ...facts } = payload;
    ledgerAccountRepo.findByCode.mockResolvedValue(controlAccount);
    ledgerAccountRepo.findById.mockResolvedValue(controlAccount);
    allocation.getNextCode.mockResolvedValue(
      String(Number(controlAccount.code) + 1).padStart(6, '0')
    );
    return service.createStatutoryReceivableSubAccount(
      { ...facts, controlAccountId: controlAccount.id },
      { correlationId: 'creation-test', tx: {} }
    );
  }

  afterEach(() => {
    expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  it('creates the receivables header when one does not exist', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [account, events, audit] = await service.createHeader(
      {
        name: 'Receivables',
        createdBy: userId,
        accountingEntity,
      },
      repoOptions
    );
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      accountingEntity.id,
      repoOptions
    );
    expect(account).toMatchObject({
      name: 'Receivables',
      code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      materializedPath: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      accountingEntityId: accountingEntity.id,
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.DefaultReceivables,
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: userId,
    });
    expect(Object.isFrozen(account)).toBe(true);
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });
  it('rejects a duplicate receivables header', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(receivablesHeader);
    await expect(
      service.createHeader(
        {
          name: 'Receivables',
          createdBy: userId,
          accountingEntity,
        },
        repoOptions
      )
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_header_account_already_exists_conflict',
      cause: { existingHeader: receivablesHeader },
    });
  });
  it('creates a trade receivable under a valid control account', async () => {
    const suppliedControlAccount = receivablesHeader;
    const [account, events, audit] = await prepareTradeReceivableSubAccount({
      controlAccount: suppliedControlAccount,
      name: 'Trade Receivables',
      createdBy: userId,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
      isControlAccount: true,
    });
    expect(account).toMatchObject({
      name: 'Trade Receivables',
      code: '102001',
      materializedPath: '102000.102001',
      behavior: EAssetAccountBehavior.TradeReceivable,
      controlAccountId: receivablesHeader.id,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    });
    expect(events).toHaveLength(1);
    expect(audit.entityId).toBe(account.id);
  });
  it('creates a statutory receivable under a valid control account', async () => {
    const suppliedControlAccount = {
      ...receivablesHeader,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
    };
    const [account] = await prepareStatutoryReceivableSubAccount({
      controlAccount: suppliedControlAccount,
      name: 'Statutory Receivables',
      createdBy: userId,
      accountingEntity,
      currency: SYSTEM_CURRENCIES.USD,
      isControlAccount: true,
    });
    expect(account).toMatchObject({
      code: ASSET_LEDGER_CODES.RECEIVABLES.TRADE,
      materializedPath: `${ASSET_LEDGER_CODES.RECEIVABLES.HEADER}.${ASSET_LEDGER_CODES.RECEIVABLES.TRADE}`,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
      controlAccountId: receivablesHeader.id,
      currency: SYSTEM_CURRENCIES.USD,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
    });
  });
  it('rejects a receivables control account from another accounting entity', async () => {
    const suppliedControlAccount = {
      ...receivablesHeader,
      accountingEntityId: generateUUID(),
    };
    await expect(
      prepareTradeReceivableSubAccount({
        controlAccount: suppliedControlAccount,
        name: 'Trade Receivables',
        createdBy: userId,
        accountingEntity,
        currency: SYSTEM_CURRENCIES.USD,
        isControlAccount: false,
      })
    ).rejects.toThrow(
      expect.objectContaining({
        errorKey: 'ledger_error_asset_account_control_account_invalid',
      })
    );
    expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });
  it.each([
    { type: ELedgerType.Liability },
    { subType: EAssetSubType.CashAndCashEquivalent },
    { isControlAccount: false },
    { behavior: EAssetAccountBehavior.StatutoryReceivable },
  ])(
    'rejects an invalid trade receivables control account: %o',
    async (change) => {
      const suppliedControlAccount = {
        ...receivablesHeader,
        ...change,
      };
      await expect(
        prepareTradeReceivableSubAccount({
          controlAccount: suppliedControlAccount,
          name: 'Trade Receivables',
          createdBy: userId,
          accountingEntity,
          currency: SYSTEM_CURRENCIES.USD,
          isControlAccount: false,
        })
      ).rejects.toThrow(
        expect.objectContaining({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
        })
      );
      expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );
  it.each([
    { type: ELedgerType.Liability },
    { subType: EAssetSubType.CashAndCashEquivalent },
    { isControlAccount: false },
    { behavior: EAssetAccountBehavior.TradeReceivable },
  ])(
    'rejects an invalid statutory receivables control account: %o',
    async (change) => {
      const suppliedControlAccount = {
        ...receivablesHeader,
        ...change,
      };
      await expect(
        prepareStatutoryReceivableSubAccount({
          controlAccount: suppliedControlAccount,
          name: 'Statutory Receivables',
          createdBy: userId,
          accountingEntity,
          currency: SYSTEM_CURRENCIES.USD,
          isControlAccount: false,
        })
      ).rejects.toThrow(
        expect.objectContaining({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
        })
      );
      expect(ledgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    }
  );
  describe('createStatutoryReceivableSubAccount protected creation', () => {
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
      typeof service.createStatutoryReceivableSubAccount
    >[0] = {
      name: 'Final account',
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
    it('uses the established default parent and creates the final version 1 state once', async () => {
      const [account, events, audit] =
        await service.createStatutoryReceivableSubAccount(payload, options);
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.RECEIVABLES.STATUTORY,
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
      expect(account.currency).toBe(SYSTEM_CURRENCIES.USD);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(account);
      expect(audit.diff).toMatchObject({ before: null, after: account });
      expect(Object.isFrozen(account)).toBe(true);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
      expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
    });
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
      const [account] = await service.createStatutoryReceivableSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
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
        service.createStatutoryReceivableSubAccount(payload, {
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
        service.createStatutoryReceivableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      ledgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createStatutoryReceivableSubAccount(
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
        service.createStatutoryReceivableSubAccount(payload, options)
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('preserves a missing nested default as a configuration error', async () => {
      ledgerAccountRepo.findByCode
        .mockResolvedValueOnce(header)
        .mockResolvedValueOnce(null);
      await expect(
        service.createStatutoryReceivableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
  });

  describe('createTradeReceivableSubAccount protected creation', () => {
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
      typeof service.createTradeReceivableSubAccount
    >[0] = {
      name: 'Final account',
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
    it('uses the established default parent and creates the final version 1 state once', async () => {
      const [account, events, audit] =
        await service.createTradeReceivableSubAccount(payload, options);
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.RECEIVABLES.TRADE,
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
      expect(account.currency).toBe(SYSTEM_CURRENCIES.USD);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(account);
      expect(audit.diff).toMatchObject({ before: null, after: account });
      expect(Object.isFrozen(account)).toBe(true);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
      expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
    });
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
      const [account] = await service.createTradeReceivableSubAccount(
        { ...payload, controlAccountId: parent.id },
        options
      );
      expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
        ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
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
        service.createTradeReceivableSubAccount(payload, {
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
        service.createTradeReceivableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
    it('rejects a missing scoped explicit parent as a domain 404', async () => {
      ledgerAccountRepo.findById.mockResolvedValueOnce(null);
      await expect(
        service.createTradeReceivableSubAccount(
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
        service.createTradeReceivableSubAccount(payload, options)
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
    });

    it('preserves a missing nested default as a configuration error', async () => {
      ledgerAccountRepo.findByCode
        .mockResolvedValueOnce(header)
        .mockResolvedValueOnce(null);
      await expect(
        service.createTradeReceivableSubAccount(payload, options)
      ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
      expect(allocation.getNextCode).not.toHaveBeenCalled();
    });
  });
});
