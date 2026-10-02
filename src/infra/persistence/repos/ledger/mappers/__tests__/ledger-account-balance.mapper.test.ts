import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import userEntity from '@domain/user/entities/user.entity';

import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

import ledgerAccountBalanceMapper, {
  ILedgerAccountBalanceAdjustmentModel,
  ILedgerAccountBalanceModel,
  INewLedgerAccountBalanceAndAdjustmentModel,
} from '@infra/persistence/repos/ledger/mappers/ledger-account-balance.mapper';

describe('Ledger Account Balance Mapper', () => {
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeBalanceAndAdjustment = async () => {
    const [user] = userEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      email: 'owner@example.com',
      emailVerified: true,
      firstName: 'Account',
      lastName: 'Owner',
    });
    const [accountingEntity] = accountingEntityEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Owner Business',
      ownerId: user.id,
      type: EAccountingEntityType.Individual,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      jurisdictionCode: 'NG',
    });
    const [account] = await cashAccountService.createHeader(
      {
        name: 'Cash',
        accountingEntity,
        createdBy: user.actorId,
      },
      { correlationId: 'test-correlation-id' }
    );
    const balance = ledgerAccountBalanceEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: account.id,
      accountingEntityId: accountingEntity.id,
      accountMaterializedPath: account.materializedPath,
      currencyCode: SYSTEM_CURRENCIES.NGN.code,
      functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    });
    const adjusted = ledgerAccountBalanceEntity.adjust(balance, {
      ledgerAccountId: account.id,
      amount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
      functionalAmount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
      journalEntryId: '123e4567-e89b-12d3-a456-426614174010' as TEntityId,
      createdBy: user.actorId,
    });

    return adjusted;
  };

  describe('balance mapping', () => {
    it('maps a balance to a repo model and back', async () => {
      const { newBalance } = await makeBalanceAndAdjustment();

      const repoModel = ledgerAccountBalanceMapper.toRepo(newBalance);

      expect(repoModel).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: newBalance.ledgerAccountId,
        accountingEntityId: newBalance.accountingEntityId,
        accountMaterializedPath: newBalance.accountMaterializedPath,
        amount: 100_00,
        currencyCode: SYSTEM_CURRENCIES.NGN.code,
        functionalAmount: 100_00,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        version: newBalance.version,
        createdAt: newBalance.createdAt.toISOString(),
        updatedAt: newBalance.updatedAt.toISOString(),
      });
      expect(ledgerAccountBalanceMapper.fromRepo(repoModel)).toEqual(
        newBalance
      );
    });

    it('maps a balance repo select with currency relations to domain', async () => {
      const { newBalance } = await makeBalanceAndAdjustment();
      const repoModel = ledgerAccountBalanceMapper.toRepo(newBalance);
      const selectModel: Parameters<
        typeof ledgerAccountBalanceMapper.toDomain
      >[0] = {
        ...repoModel,
        currency: {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          code: SYSTEM_CURRENCIES.NGN.code,
          symbol: SYSTEM_CURRENCIES.NGN.symbol,
          name: SYSTEM_CURRENCIES.NGN.name,
          minorUnit: Number(SYSTEM_CURRENCIES.NGN.minorUnit),
          createdAt: newBalance.createdAt.toISOString(),
          updatedAt: newBalance.updatedAt.toISOString(),
          deletedAt: null,
        },
        functionalCurrency: {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          code: SYSTEM_CURRENCIES.NGN.code,
          symbol: SYSTEM_CURRENCIES.NGN.symbol,
          name: SYSTEM_CURRENCIES.NGN.name,
          minorUnit: Number(SYSTEM_CURRENCIES.NGN.minorUnit),
          createdAt: newBalance.createdAt.toISOString(),
          updatedAt: newBalance.updatedAt.toISOString(),
          deletedAt: null,
        },
      };

      expect(ledgerAccountBalanceMapper.toDomain(selectModel)).toEqual(
        newBalance
      );
    });
  });

  it.each([
    '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
    '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])(
    'round-trips complete $type attribution through JSON storage',
    async (createdBy) => {
      const { adjustment } = await makeBalanceAndAdjustment();
      const model = ledgerAccountBalanceMapper.toRepoAdjustment({
        ...adjustment,
        createdBy,
      });
      const restored = ledgerAccountBalanceMapper.fromRepoAdjustment({
        ...model,
        createdBy: JSON.parse(JSON.stringify(model.createdBy)),
      });
      expect(restored.createdBy).toEqual(createdBy);
    }
  );

  describe('adjustment mapping', () => {
    it('maps an adjustment to a repo model and back', async () => {
      const { adjustment } = await makeBalanceAndAdjustment();

      const repoModel = ledgerAccountBalanceMapper.toRepoAdjustment(adjustment);

      expect(repoModel).toEqual({
        id: adjustment.id,
        ledgerAccountId: adjustment.ledgerAccountId,
        amount: 100_00,
        currencyCode: SYSTEM_CURRENCIES.NGN.code,
        functionalAmount: 100_00,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        journalEntryId: adjustment.journalEntryId,
        effect: adjustment.effect,
        createdBy: adjustment.createdBy,
        createdAt: adjustment.createdAt.toISOString(),
      });
      expect(ledgerAccountBalanceMapper.fromRepoAdjustment(repoModel)).toEqual(
        adjustment
      );
    });

    it('maps an adjustment to a DTO', async () => {
      const { adjustment } = await makeBalanceAndAdjustment();

      expect(ledgerAccountBalanceMapper.toAdjustmentDto(adjustment)).toEqual({
        id: adjustment.id,
        ledgerAccountId: adjustment.ledgerAccountId,
        amount: {
          amount: 100_00,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: true,
        },
        functionalAmount: {
          amount: 100_00,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: true,
        },
        journalEntryId: adjustment.journalEntryId,
        effect: adjustment.effect,
        createdBy: adjustment.createdBy,
        createdAt: adjustment.createdAt,
      });
    });
  });

  describe('new balance and adjustment mapping', () => {
    it('maps the aggregate repo shape and back', async () => {
      const payload = await makeBalanceAndAdjustment();
      const repoModel: INewLedgerAccountBalanceAndAdjustmentModel = {
        newBalance: ledgerAccountBalanceMapper.toRepo(
          payload.newBalance
        ) as ILedgerAccountBalanceModel,
        adjustment: ledgerAccountBalanceMapper.toRepoAdjustment(
          payload.adjustment
        ) as ILedgerAccountBalanceAdjustmentModel,
      };

      expect(
        ledgerAccountBalanceMapper.toRepoNewBalanceAndAdjustment(payload)
      ).toEqual(repoModel);
      expect(
        ledgerAccountBalanceMapper.fromRepoNewBalanceAndAdjustment(repoModel)
      ).toEqual(payload);
    });
  });
});
