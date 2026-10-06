import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
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
const [header] = ledgerAccountEntity.make({
  name: 'Receivables root',
  code: '102000',
  materializedPath: '102000',
  accountingEntityId: generateUUID(),
  createdBy: generateUUID(),
  type: 'asset',
  subType: 'receivables',
  behavior: 'default_receivables',
  normalBalance: 'debit',
  isControlAccount: true,
  controlAccountId: null,
  currency: SYSTEM_CURRENCIES.NGN,
  meta: null,
  status: 'active',
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});
const [parent] = ledgerAccountEntity.make({
  ...header,
  name: 'Trade receivables',
  code: '102001',
  materializedPath: '102000.102001',
  controlAccountId: header.id,
  behavior: 'trade_receivable',
});
const payload: Parameters<typeof getLockedControlAccountHelper>[1] = {
  accountingEntityId: header.accountingEntityId,
  allocationHeaderCode: header.code,
  defaultControlAccountCode: header.code,
};
const repoOptions = Object.freeze({
  correlationId: 'parent-lookup',
  tx: {},
  lock: ERepoLock.Share,
});
const lockedOptions = { ...repoOptions, lock: ERepoLock.Update };

describe('getLockedControlAccountHelper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    ledgerAccountRepo.findByCode.mockResolvedValue(header);
    ledgerAccountRepo.findById.mockResolvedValue(parent);
  });

  it('reuses the locked root when it is the default parent', async () => {
    const account = await getLockedControlAccountHelper(
      ledgerAccountRepo,
      payload,
      repoOptions
    );
    expect(account).toBe(header);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      header.code,
      header.accountingEntityId,
      lockedOptions
    );
    expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(repoOptions.lock).toBe(ERepoLock.Share);
    expect(ledgerAccountRepo.findByCode.mock.calls[0][2].tx).toBe(
      repoOptions.tx
    );
  });

  it('locks the root before resolving an explicit scoped parent', async () => {
    const account = await getLockedControlAccountHelper(
      ledgerAccountRepo,
      { ...payload, controlAccountId: parent.id },
      repoOptions
    );
    expect(account).toBe(parent);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledWith(
      header.code,
      header.accountingEntityId,
      lockedOptions
    );
    expect(ledgerAccountRepo.findById).toHaveBeenCalledTimes(1);
    expect(ledgerAccountRepo.findById).toHaveBeenCalledWith(
      parent.id,
      header.accountingEntityId,
      lockedOptions
    );
    expect(
      ledgerAccountRepo.findByCode.mock.invocationCallOrder[0]
    ).toBeLessThan(ledgerAccountRepo.findById.mock.invocationCallOrder[0]);
  });

  it('locks the root before resolving a different configured default', async () => {
    ledgerAccountRepo.findByCode
      .mockResolvedValueOnce(header)
      .mockResolvedValueOnce(parent);
    const account = await getLockedControlAccountHelper(
      ledgerAccountRepo,
      { ...payload, defaultControlAccountCode: parent.code },
      repoOptions
    );
    expect(account).toBe(parent);
    expect(ledgerAccountRepo.findByCode.mock.calls).toEqual([
      [header.code, header.accountingEntityId, lockedOptions],
      [parent.code, header.accountingEntityId, lockedOptions],
    ]);
    expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('reports a missing root before looking up a selected parent', async () => {
    ledgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    await expect(
      getLockedControlAccountHelper(
        ledgerAccountRepo,
        { ...payload, controlAccountId: parent.id },
        repoOptions
      )
    ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
    expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('reports a missing scoped explicit ID with the domain 404 error', async () => {
    ledgerAccountRepo.findById.mockResolvedValueOnce(null);
    await expect(
      getLockedControlAccountHelper(
        ledgerAccountRepo,
        { ...payload, controlAccountId: parent.id },
        repoOptions
      )
    ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountIdNotFound);
    expect(ledgerAccountRepo.findByCode).toHaveBeenCalledTimes(1);
  });

  it('reports a missing configured nested default with the configuration error', async () => {
    ledgerAccountRepo.findByCode
      .mockResolvedValueOnce(header)
      .mockResolvedValueOnce(null);
    await expect(
      getLockedControlAccountHelper(
        ledgerAccountRepo,
        { ...payload, defaultControlAccountCode: parent.code },
        repoOptions
      )
    ).rejects.toBeInstanceOf(ledgerAccountError.ControlAccountNotFound);
    expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it.each(['root', 'explicit', 'default'] as const)(
    'preserves a %s repository failure',
    async (stage) => {
      const failure = new Error('repository unavailable');
      if (stage === 'root')
        ledgerAccountRepo.findByCode.mockRejectedValueOnce(failure);
      if (stage === 'explicit')
        ledgerAccountRepo.findById.mockRejectedValueOnce(failure);
      if (stage === 'default')
        ledgerAccountRepo.findByCode
          .mockResolvedValueOnce(header)
          .mockRejectedValueOnce(failure);
      await expect(
        getLockedControlAccountHelper(
          ledgerAccountRepo,
          {
            ...payload,
            defaultControlAccountCode: parent.code,
            controlAccountId: stage === 'explicit' ? parent.id : undefined,
          },
          repoOptions
        )
      ).rejects.toBe(failure);
      expect(ledgerAccountRepo.create).not.toHaveBeenCalled();
      expect(ledgerAccountRepo.update).not.toHaveBeenCalled();
    }
  );
  it('rejects an archived allocation root before resolving a parent', async () => {
    const [archivedHeader] = ledgerAccountEntity.archive(header);
    ledgerAccountRepo.findByCode.mockResolvedValue(archivedHeader);

    await expect(
      getLockedControlAccountHelper(ledgerAccountRepo, payload, repoOptions)
    ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
  });

  it('does not resolve an explicit parent when the allocation root is archived', async () => {
    const [archivedHeader] = ledgerAccountEntity.archive(header);
    ledgerAccountRepo.findByCode.mockResolvedValue(archivedHeader);

    await expect(
      getLockedControlAccountHelper(
        ledgerAccountRepo,
        { ...payload, controlAccountId: parent.id },
        repoOptions
      )
    ).rejects.toBeInstanceOf(ledgerAccountError.ArchivedControlAccount);
    expect(ledgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'returns an archived selected parent with explicit ID %s for the caller to validate',
    async (explicit) => {
      const [archivedParent] = ledgerAccountEntity.archive(parent);
      ledgerAccountRepo.findById.mockResolvedValue(archivedParent);
      ledgerAccountRepo.findByCode
        .mockResolvedValueOnce(header)
        .mockResolvedValueOnce(archivedParent);
      const lookup = explicit
        ? { ...payload, controlAccountId: parent.id }
        : { ...payload, defaultControlAccountCode: parent.code };

      await expect(
        getLockedControlAccountHelper(ledgerAccountRepo, lookup, repoOptions)
      ).resolves.toBe(archivedParent);
    }
  );
});
