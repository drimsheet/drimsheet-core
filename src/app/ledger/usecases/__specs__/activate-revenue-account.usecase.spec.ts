import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockRevenueAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeActivateRevenueAccountUsecase from '@app/ledger/usecases/activate-revenue-account.usecase';

const [actor] = actorEntity.makeUser({
  email: 'revenue@example.com',
  displayName: 'Owner',
});
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const correlationId = 'revenue-activate';
const idempotencyKey = 'revenue-activate-request';
const [account] = ledgerAccountEntity.make<ILedgerAccount>({
  name: 'Consulting',
  code: '401001',
  materializedPath: '401000.401001',
  accountingEntityId: accountingEntity.id,
  createdBy: actor.id,
  type: 'revenue',
  subType: 'services',
  behavior: 'services',
  normalBalance: 'credit',
  isControlAccount: false,
  controlAccountId: actor.id,
  currency: null,
  status: 'draft',
  meta: null,
  contraAccountRule: 'contra_not_permitted',
  adjunctAccountRule: 'adjunct_not_permitted',
});
const usecase = makeActivateRevenueAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  ledgerAccountRepo: mockLedgerAccountRepo,
  revenueAccountService: mockRevenueAccountService,
});

describe('activate revenue account workflow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
      idempotencyKey,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockRevenueAccountService.activate.mockResolvedValue(
      ledgerAccountEntity.activate(account)
    );
  });

  it('scopes the read and persists one versioned audit before publishing', async () => {
    await expect(usecase(account.id)).resolves.toBeUndefined();
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      accountingEntity.id,
      { correlationId }
    );
    expect(mockRevenueAccountService.activate).toHaveBeenCalledWith(account, {
      correlationId,
    });
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
    const [updated, options] = mockLedgerAccountRepo.update.mock.calls[0];
    expect(updated).toEqual({
      ...account,
      status: 'active',
      version: account.version + 1,
      updatedAt: expect.any(Date),
    });
    expect(options).toMatchObject({
      correlationId,
      expectedVersion: account.version,
      history: {
        actorId: actor.id,
        correlationId,
        diff: {
          before: JSON.parse(JSON.stringify(account)),
          after: JSON.parse(JSON.stringify(updated)),
        },
      },
    });
    expect(options).not.toHaveProperty('tx');
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({ data: updated, correlationId, idempotencyKey }),
    ]);
    expect(
      mockLedgerAccountRepo.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
  });

  it('rejects malformed IDs before reading', async () => {
    await expect(usecase('invalid')).rejects.toMatchObject({
      errorKey: 'ledger_error_id_invalid',
    });
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockRevenueAccountService.activate).not.toHaveBeenCalled();
  });

  it('rejects an absent account without writing', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(account.id)).rejects.toMatchObject({
      errorKey: 'app_error_ledger_account_not_found',
    });
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    new ledgerAccountError.InvalidType(),
    new ledgerAccountError.InvalidStatus(),
    new ledgerAccountError.ControlAccountNotFound(),
  ])('propagates domain rejection before writing', async (failure) => {
    mockRevenueAccountService.activate.mockImplementation(() => {
      throw failure;
    });
    await expect(usecase(account.id)).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates read failures without writing', async () => {
    const failure = new Error('read failed');
    mockLedgerAccountRepo.findById.mockRejectedValue(failure);
    await expect(usecase(account.id)).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each([new repoError.VersionNotFound(), new Error('write failed')])(
    'does not publish after a failed atomic write',
    async (failure) => {
      mockLedgerAccountRepo.update.mockRejectedValue(failure);
      await expect(usecase(account.id)).rejects.toBe(failure);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('propagates publication failure without repeating the committed write', async () => {
    const failure = new Error('publish failed');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(usecase(account.id)).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
  });
});
