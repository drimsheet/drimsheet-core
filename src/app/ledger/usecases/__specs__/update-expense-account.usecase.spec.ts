import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockExpenseAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import makeUpdateExpenseAccountUsecase from '@app/ledger/usecases/update-expense-account.usecase';

const [actor] = actorEntity.makeUser({
  email: 'expense@example.com',
  displayName: 'Owner',
});
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const correlationId = 'expense-update';
const idempotencyKey = 'expense-update-request';
const [account] = ledgerAccountEntity.make<ILedgerAccount>({
  name: 'Consulting',
  code: '502001',
  materializedPath: '502000.502001',
  accountingEntityId: accountingEntity.id,
  createdBy: actor.id,
  type: 'expense',
  subType: 'rent_and_utilities',
  behavior: 'rent_and_utilities',
  normalBalance: 'debit',
  isControlAccount: false,
  controlAccountId: actor.id,
  currency: null,
  status: 'active',
  meta: null,
  contraAccountRule: 'contra_not_permitted',
  adjunctAccountRule: 'adjunct_not_permitted',
});
const usecase = makeUpdateExpenseAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  ledgerAccountRepo: mockLedgerAccountRepo,
  expenseAccountService: mockExpenseAccountService,
  balanceEnrichmentAppService: mockBalanceEnrichmentAppService,
});

describe('update expense account workflow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
      idempotencyKey,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockExpenseAccountService.update.mockReturnValue(
      ledgerAccountEntity.update(account, { name: 'Advisory' })
    );
    mockBalanceEnrichmentAppService.enrich.mockImplementation(
      async (accounts) =>
        accounts.map((current) =>
          ledgerAccountToDtoMapperHelper(current, null, 'NGN')
        )
    );
  });

  it('scopes the read and persists one versioned audit before publishing and enriching', async () => {
    const response = await usecase(account.id, { name: 'Advisory' });
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      accountingEntity.id,
      { correlationId }
    );
    expect(mockExpenseAccountService.update).toHaveBeenCalledWith(account, {
      name: 'Advisory',
    });
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
    const [updated, options] = mockLedgerAccountRepo.update.mock.calls[0];
    expect(updated).toEqual({
      ...account,
      name: 'Advisory',
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
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
      mockBalanceEnrichmentAppService.enrich.mock.invocationCallOrder[0]
    );
    expect(mockBalanceEnrichmentAppService.enrich).toHaveBeenCalledWith(
      [updated],
      accountingEntity,
      { correlationId }
    );
    expect(response).toEqual(
      ledgerAccountToDtoMapperHelper(updated, null, 'NGN')
    );
    expect(response).not.toHaveProperty('version');
  });

  it('returns the enriched account without writes or events when the domain returns no change', async () => {
    mockExpenseAccountService.update.mockReturnValue([account, [], null]);
    await usecase(account.id, { name: '  Consulting  ' });
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockBalanceEnrichmentAppService.enrich).toHaveBeenCalledWith(
      [account],
      accountingEntity,
      { correlationId }
    );
  });

  it('rejects malformed IDs and payloads before reading', async () => {
    await expect(
      usecase('invalid', { name: 'Advisory' })
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_id_invalid',
    });
    await expect(usecase(account.id, { name: '' })).rejects.toMatchObject({
      errorKey: 'app_error_validation_error',
    });
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockExpenseAccountService.update).not.toHaveBeenCalled();
  });

  it('rejects an absent account without writing', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(
      usecase(account.id, { name: 'Advisory' })
    ).rejects.toMatchObject({ errorKey: 'app_error_ledger_account_not_found' });
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    new ledgerAccountError.InvalidType(),
    new ledgerAccountError.InvalidStatus(),
    new ledgerAccountError.InvalidName(),
  ])('propagates domain rejection before writing', async (failure) => {
    mockExpenseAccountService.update.mockImplementation(() => {
      throw failure;
    });
    await expect(usecase(account.id, { name: 'Advisory' })).rejects.toBe(
      failure
    );
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockBalanceEnrichmentAppService.enrich).not.toHaveBeenCalled();
  });

  it('propagates read failures without writing', async () => {
    const failure = new Error('read failed');
    mockLedgerAccountRepo.findById.mockRejectedValue(failure);
    await expect(usecase(account.id, { name: 'Advisory' })).rejects.toBe(
      failure
    );
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it.each([new repoError.VersionNotFound(), new Error('write failed')])(
    'does not publish or enrich after a failed atomic write',
    async (failure) => {
      mockLedgerAccountRepo.update.mockRejectedValue(failure);
      await expect(usecase(account.id, { name: 'Advisory' })).rejects.toBe(
        failure
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockBalanceEnrichmentAppService.enrich).not.toHaveBeenCalled();
    }
  );

  it('propagates publication failure without repeating the committed write', async () => {
    const failure = new Error('publish failed');
    mockEventBus.publish.mockRejectedValue(failure);
    await expect(usecase(account.id, { name: 'Advisory' })).rejects.toBe(
      failure
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
    expect(mockBalanceEnrichmentAppService.enrich).not.toHaveBeenCalled();
  });

  it('propagates enrichment failure after the write and publication', async () => {
    const failure = new Error('enrichment failed');
    mockBalanceEnrichmentAppService.enrich.mockRejectedValue(failure);
    await expect(usecase(account.id, { name: 'Advisory' })).rejects.toBe(
      failure
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
});
