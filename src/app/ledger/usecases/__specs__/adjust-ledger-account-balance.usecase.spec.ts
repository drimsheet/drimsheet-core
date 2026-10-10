import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import { EOutboxType, IOutbox } from '@shared/types/outbox.types';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockLedgerBalancePropagationPreparationAppService from '@app/ledger/contracts/__mocks__/ledger-balance-propagation-preparation.service.mock';
import { mockLedgerAccountBalanceRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeAdjustLedgerAccountBalanceUseCase from '@app/ledger/usecases/adjust-ledger-account-balance.usecase';
import mockOutboxRepo from '@app/outbox/contracts/__mocks__/outbox.repo.mock';

describe('makeAdjustLedgerAccountBalanceUseCase', () => {
  const correlationId = generateUUID();
  const journalEntryId = generateUUID();
  const accountingEntityId = generateUUID();
  const creatorId = generateUUID();
  const tx = 'transaction' as unknown as ITransactionContext;
  const childAccountId = generateUUID();
  const parentAccountId = generateUUID();

  const outbox: IOutbox = {
    id: journalEntryId,
    correlationId,
    type: EOutboxType.BalancePropagation,
    data: null,
    createdAt: new Date(),
  };
  const childBalance = ledgerAccountBalanceEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: childAccountId,
    accountingEntityId,
    accountMaterializedPath: '100000.100001',
    currencyCode: SYSTEM_CURRENCIES.USD.code,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  });
  const parentBalance = ledgerAccountBalanceEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: parentAccountId,
    accountingEntityId,
    accountMaterializedPath: '100000',
    currencyCode: SYSTEM_CURRENCIES.NGN.code,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  });
  const preparedAdjustments = [
    {
      balanceAdjustment: ledgerAccountBalanceEntity.adjust(childBalance, {
        ledgerAccountId: childAccountId,
        amount: { amount: 100n, currency: SYSTEM_CURRENCIES.USD },
        functionalAmount: {
          amount: 150_000n,
          currency: SYSTEM_CURRENCIES.NGN,
        },
        journalEntryId,
        createdBy: creatorId,
      }),
      expectedVersion: childBalance.version,
    },
    {
      balanceAdjustment: ledgerAccountBalanceEntity.adjust(parentBalance, {
        ledgerAccountId: parentAccountId,
        amount: { amount: 150_000n, currency: SYSTEM_CURRENCIES.NGN },
        functionalAmount: {
          amount: 150_000n,
          currency: SYSTEM_CURRENCIES.NGN,
        },
        journalEntryId,
        createdBy: creatorId,
      }),
      expectedVersion: parentBalance.version,
    },
  ];
  const payload: ILedgerAccountBalanceAdjustmentDto = {
    journalEntryId,
    correlationId,
  };

  const getUseCase = () =>
    makeAdjustLedgerAccountBalanceUseCase({
      repoService: mockRepoService,
      outboxRepo: mockOutboxRepo,
      ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
      balancePropagationPreparationAppService:
        mockLedgerBalancePropagationPreparationAppService,
      reporter: mockReporter,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.runInTransaction.mockImplementation((fn) => fn(tx));
    mockOutboxRepo.findByIdAndType.mockResolvedValue(outbox);
    mockOutboxRepo.delete.mockResolvedValue(true);
    mockLedgerBalancePropagationPreparationAppService.prepare.mockResolvedValue(
      preparedAdjustments
    );
    mockLedgerAccountBalanceRepo.adjustBalance.mockResolvedValue();
  });

  it('writes every adjustment and then deletes the outbox in one transaction', async () => {
    await getUseCase()(payload);

    expect(mockOutboxRepo.findByIdAndType).toHaveBeenCalledWith(
      journalEntryId,
      EOutboxType.BalancePropagation,
      { correlationId }
    );
    expect(
      mockLedgerBalancePropagationPreparationAppService.prepare
    ).toHaveBeenCalledWith(journalEntryId, { correlationId });
    expect(mockLedgerAccountBalanceRepo.adjustBalance).toHaveBeenNthCalledWith(
      1,
      preparedAdjustments[0].balanceAdjustment,
      { correlationId, tx, expectedVersion: childBalance.version }
    );
    expect(mockLedgerAccountBalanceRepo.adjustBalance).toHaveBeenNthCalledWith(
      2,
      preparedAdjustments[1].balanceAdjustment,
      { correlationId, tx, expectedVersion: parentBalance.version }
    );
    expect(mockLedgerAccountBalanceRepo.adjustBalance).toHaveBeenCalledTimes(2);
    expect(mockOutboxRepo.delete).toHaveBeenCalledWith(outbox.id, {
      correlationId,
      tx,
    });
    expect(mockReporter.report).not.toHaveBeenCalled();
    expect(
      mockLedgerBalancePropagationPreparationAppService.prepare.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockRepoService.runInTransaction.mock.invocationCallOrder[0]
    );
    const adjustmentCallOrder =
      mockLedgerAccountBalanceRepo.adjustBalance.mock.invocationCallOrder;
    expect(adjustmentCallOrder[adjustmentCallOrder.length - 1]).toBeLessThan(
      mockOutboxRepo.delete.mock.invocationCallOrder[0]
    );
  });

  it('reports a missing outbox row and skips balance updates', async () => {
    mockOutboxRepo.findByIdAndType.mockResolvedValue(null);

    await getUseCase()(payload);

    expect(mockReporter.report).toHaveBeenCalledWith(
      'ledger.balance_outbox.missing',
      expect.objectContaining({
        errorKey: 'app_error_ledger_balance_propagation_outbox_not_found',
        cause: { journalEntryId },
      })
    );
    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    expect(mockOutboxRepo.delete).not.toHaveBeenCalled();
    expect(
      mockLedgerBalancePropagationPreparationAppService.prepare
    ).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('does not open a transaction when preparation fails', async () => {
    mockLedgerBalancePropagationPreparationAppService.prepare.mockRejectedValueOnce(
      new ledgerAppError.BalanceNotFound()
    );

    await expect(getUseCase()(payload)).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );
    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    expect(mockOutboxRepo.delete).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('does not delete the outbox when an adjustment write fails', async () => {
    mockLedgerAccountBalanceRepo.adjustBalance.mockRejectedValueOnce(
      new Error('write failed')
    );

    await expect(getUseCase()(payload)).rejects.toThrow('write failed');
    expect(mockOutboxRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects an invalid journal trigger before opening a transaction', async () => {
    await expect(
      getUseCase()({ ...payload, journalEntryId: 'invalid' as TEntityId })
    ).rejects.toThrow();

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(
      mockLedgerBalancePropagationPreparationAppService.prepare
    ).not.toHaveBeenCalled();
  });
});
