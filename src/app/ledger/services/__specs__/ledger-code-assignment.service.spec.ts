import { ERepoLock, ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeLedgerCodeAssignmentAppService from '@app/ledger/services/ledger-code-assignment.service';

describe('ledgerCodeAssignmentAppService', () => {
  const service = makeLedgerCodeAssignmentAppService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  const tx: ITransactionContext = {};
  const repoOptions = { correlationId: 'assignment-spec', tx };
  let header: ILedgerAccount;
  let auditedAccount: TAuditedLedgerAccount;

  const payload = () => ({
    account: auditedAccount[0],
    allocationHeaderCode: '100000',
  });

  beforeEach(() => {
    jest.resetAllMocks();
    [header] = ledgerAccountEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      accountingEntityId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      name: 'Cash header',
      code: '100000',
      materializedPath: '100000',
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      behavior: 'default_cash',
      normalBalance: 'debit',
      isControlAccount: true,
      controlAccountId: null,
      currency: SYSTEM_CURRENCIES.NGN,
      status: 'active',
      contraAccountRule: 'contra_permitted',
      adjunctAccountRule: 'adjunct_permitted',
      meta: null,
    });
    auditedAccount = ledgerAccountEntity.make({
      ...header,
      name: 'Petty cash',
      code: '100001',
      materializedPath: '100000.100001',
      behavior: 'petty_cash',
      isControlAccount: false,
      controlAccountId: header.id,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValue(header);
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValue({
      id: header.id,
      code: '100008',
      materializedPath: '100000.100008',
    });
  });

  it.each([false, true])(
    'returns only the audited code update (opening balance: %s)',
    async (withOpening) => {
      if (withOpening) {
        auditedAccount = ledgerAccountEntity.updateOpeningBalanceDate(
          auditedAccount[0],
          new Date('2026-01-01T00:00:00Z')
        );
      }
      mockLedgerAccountRepo.findByCode.mockResolvedValue(header);
      const [account, events, audit] = await service.assign(
        payload(),
        repoOptions
      );

      expect(account).toMatchObject({
        code: '100009',
        materializedPath: '100000.100009',
        version: withOpening ? 3 : 2,
      });
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe(account);
      expect(audit).toMatchObject({
        entityVersion: account.version,
        diff: {
          before: payload().account,
          after: account,
        },
      });
      expect(auditedAccount[0].code).toBe('100001');
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
        '100000',
        account.accountingEntityId,
        { ...repoOptions, lock: ERepoLock.Update }
      );
      expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
        account.accountingEntityId,
        account.type,
        account.subType,
        repoOptions
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
    }
  );

  it('waits for the header lock before reading the latest code', async () => {
    let releaseLock!: (account: typeof header) => void;
    mockLedgerAccountRepo.findByCode.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseLock = resolve;
      })
    );
    const assignment = service.assign(payload(), repoOptions);
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    releaseLock(header);
    await assignment;
    expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledTimes(1);
  });

  it('retains the predecessor fallback when no latest account is returned', async () => {
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);
    expect((await service.assign(payload(), repoOptions))[0].code).toBe(
      '100001'
    );
  });

  it('preserves a nested parent path without changing the shared header lock', async () => {
    const [parent] = ledgerAccountEntity.make({
      ...header,
      code: '100003',
      materializedPath: '100000.100003',
      controlAccountId: header.id,
      behavior: 'petty_cash',
    });
    auditedAccount = ledgerAccountEntity.make({
      ...auditedAccount[0],
      controlAccountId: parent.id,
      materializedPath: '100000.100003.100001',
    });
    expect(
      (await service.assign(payload(), repoOptions))[0].materializedPath
    ).toBe('100000.100003.100009');
    expect(mockLedgerAccountRepo.findByCode.mock.calls[0][0]).toBe('100000');
  });

  it('requires an existing transaction before any read', async () => {
    await expect(
      // @ts-expect-error Exercise the runtime guard for an untyped caller.
      service.assign(payload(), { correlationId: 'spec' })
    ).rejects.toBeInstanceOf(ledgerAppError.AssignmentTransactionRequired);
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
  });

  it('rejects a missing allocation header', async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    await expect(service.assign(payload(), repoOptions)).rejects.toBeInstanceOf(
      ledgerAccountError.ControlAccountNotFound
    );
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.create).not.toHaveBeenCalled();
  });

  it('propagates the domain code limit', async () => {
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce({
      id: header.id,
      code: '100999',
      materializedPath: '100000.100999',
    });
    await expect(service.assign(payload(), repoOptions)).rejects.toBeInstanceOf(
      ledgerAccountError.MaximumLimitReached
    );
  });

  it.each(['findByCode', 'findLatestBySubType'] as const)(
    'propagates %s failures',
    async (method) => {
      const failure = new Error('database unavailable');
      mockLedgerAccountRepo[method].mockRejectedValueOnce(failure);
      await expect(service.assign(payload(), repoOptions)).rejects.toBe(
        failure
      );
    }
  );
});
