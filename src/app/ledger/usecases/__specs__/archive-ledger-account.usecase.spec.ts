import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeLedgerAccountArchiveService from '@domain/ledger/services/ledger-account-archive.service';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeArchiveLedgerAccountUsecase from '@app/ledger/usecases/archive-ledger-account.usecase';

const [account] = ledgerAccountEntity.make({
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId: generateUUID(),
  createdBy: generateUUID(),
  name: 'Cash control',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'default_cash',
  normalBalance: 'debit',
  isControlAccount: true,
  controlAccountId: generateUUID(),
  currency: null,
  status: 'active',
  meta: null,
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});
const [child] = ledgerAccountEntity.make({
  ...account,
  code: '100002',
  materializedPath: '100000.100001.100002',
  controlAccountId: account.id,
  isControlAccount: false,
  status: 'draft',
});
const actorId = generateUUID();
const usecase = makeArchiveLedgerAccountUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  archiveService: makeLedgerAccountArchiveService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  }),
  repoService: mockRepoService,
  eventBus: mockEventBus,
});

describe('archive ledger account use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: { id: account.accountingEntityId },
      correlationId: 'archive',
      idempotencyKey: 'request',
    } as IAppContextData);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([child]);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
  });

  it('loads once and commits the cascade and attributed histories before publishing', async () => {
    expect(await usecase(account.id)).toBeUndefined();
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      account.accountingEntityId,
      { correlationId: 'archive' }
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(2);
    for (const [archived, options] of mockLedgerAccountRepo.update.mock.calls) {
      expect(options).toMatchObject({
        tx: mockRepoTransaction.context,
        expectedVersion: 1,
        history: {
          entityId: archived.id,
          entityVersion: 2,
          action: 'archived',
          actorId,
          correlationId: 'archive',
        },
      });
    }
    expect(mockLedgerAccountRepo.findDescendants).toHaveBeenCalledWith(
      account.accountingEntityId,
      account.materializedPath,
      { correlationId: 'archive', tx: mockRepoTransaction.context }
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'domain:ledger:account:archived',
          correlationId: 'archive',
          idempotencyKey: 'request',
        }),
      ])
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockRepoTransaction.commit).toHaveBeenCalledWith();
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
  });

  it('archives a supplied leaf without any root or descendant lookup', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(child);
    await usecase(child.id);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountRepo.update.mock.calls[0][0].id).toBe(child.id);
  });

  it('archives more descendants than the default page size', async () => {
    const descendants = Array.from({ length: 60 }, (_, index) => {
      const code = `100${String(index + 2).padStart(3, '0')}`;
      return ledgerAccountEntity.make({
        ...child,
        code,
        materializedPath: `${account.materializedPath}.${code}`,
      })[0];
    });
    mockLedgerAccountRepo.findDescendants.mockResolvedValue(descendants);
    await usecase(account.id);
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledTimes(61);
    expect(mockLedgerAccountRepo.findAll).not.toHaveBeenCalled();
  });

  it('does not write an already archived account', async () => {
    const [archived] = ledgerAccountEntity.archive(account);
    mockLedgerAccountRepo.findById.mockResolvedValue(archived);
    expect(await usecase(account.id)).toBeUndefined();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findDescendants).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith([]);
  });

  it('rejects a missing target before opening a transaction', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(account.id)).rejects.toBeInstanceOf(
      ledgerAccountError.AccountNotFound
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a header through the domain service before writing', async () => {
    const [header] = ledgerAccountEntity.make({
      ...account,
      code: '100000',
      materializedPath: '100000',
      controlAccountId: null,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(header);
    await expect(usecase(header.id)).rejects.toBeInstanceOf(
      ledgerAccountError.HeaderAccountNotArchivable
    );
    expect(mockRepoTransaction.handleError).toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('uses each account’s prior version for the target and descendants', async () => {
    const [updatedChild] = ledgerAccountEntity.updateOpeningBalanceDate(
      child,
      new Date('2020-01-01')
    );
    mockLedgerAccountRepo.findDescendants.mockResolvedValue([updatedChild]);
    await usecase(account.id);
    expect(mockLedgerAccountRepo.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: account.id, version: account.version + 1 }),
      expect.objectContaining({ expectedVersion: account.version })
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: updatedChild.id,
        version: updatedChild.version + 1,
      }),
      expect.objectContaining({ expectedVersion: updatedChild.version })
    );
  });

  it('hands descendant write failure to the transaction handler without publishing', async () => {
    const error = new repoError.VersionNotFound();
    mockLedgerAccountRepo.update
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(error);
    await expect(usecase(account.id)).rejects.toBe(error);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('hands commit failure to the transaction handler without publishing', async () => {
    const error = new Error('commit failed');
    mockRepoTransaction.commit.mockRejectedValueOnce(error);
    await expect(usecase(account.id)).rejects.toBe(error);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(error);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('validates the account ID before reading context', async () => {
    await expect(usecase('invalid')).rejects.toThrow();
    expect(mockAppContext.get).not.toHaveBeenCalled();
  });
});
