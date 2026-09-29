import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import getControlAccountScope from '@domain/ledger/services/helpers/get-control-account-scope.helper';
import { EAssetSubType } from '@domain/ledger/types/asset-account.types';
import {
  TCashLedgerCode,
  TPayablesLedgerCode,
} from '@domain/ledger/types/ledger-code.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { ELiabilitySubType } from '@domain/ledger/types/liability-account.types';

const mockLedgerAccountRepo: jest.Mocked<ILedgerAccountRepo> = {
  findByCodeForUpdate: jest.fn(),
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

describe('getControlAccountScope', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const controlAccountId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'test-correlation-id',
  };
  const controlAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: controlAccountId,
    code: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
    materializedPath: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
    type: ELedgerType.Asset,
    subType: EAssetSubType.CashAndCashEquivalent,
    isControlAccount: true,
  } as ILedgerAccount;
  const validator = jest.fn<boolean, [ILedgerAccount]>();

  beforeEach(() => {
    jest.clearAllMocks();
    validator.mockReturnValue(true);
  });

  it('resolves the supplied control account and uses the latest account code', async () => {
    const latestAccount = {
      id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
      code: '100002',
      materializedPath: '100000.100002',
    };
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(
      latestAccount
    );

    const result = await getControlAccountScope<TCashLedgerCode>({
      ledgerAccountRepo: mockLedgerAccountRepo,
      accountingEntityId,
      controlAccountCode: ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      repoOptions,
      validator,
    });

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS.HEADER,
      accountingEntityId,
      repoOptions
    );
    expect(validator).toHaveBeenCalledWith(controlAccount);
    expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      accountingEntityId,
      ELedgerType.Asset,
      EAssetSubType.CashAndCashEquivalent,
      repoOptions
    );
    expect(result).toEqual({
      controlAccount,
      factoryContext: {
        precedingCode: latestAccount.code,
        parentMaterializedPath: controlAccount.materializedPath,
      },
    });
  });

  it('uses an explicit control account code as the preceding code when no latest account exists', async () => {
    const explicitControlAccountCode = '100010' as TCashLedgerCode;
    const explicitControlAccount = {
      ...controlAccount,
      code: explicitControlAccountCode,
      materializedPath: explicitControlAccountCode,
    };
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
      explicitControlAccount
    );
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    const result = await getControlAccountScope<TCashLedgerCode>({
      ledgerAccountRepo: mockLedgerAccountRepo,
      accountingEntityId,
      controlAccountCode: explicitControlAccountCode,
      repoOptions,
      validator,
    });

    expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledWith(
      explicitControlAccountCode,
      accountingEntityId,
      repoOptions
    );
    expect(result.factoryContext).toEqual({
      precedingCode: explicitControlAccountCode,
      parentMaterializedPath: explicitControlAccountCode,
    });
  });

  it('scopes the latest allocation read to a non-cash control account family', async () => {
    const payableControlAccount = {
      ...controlAccount,
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      materializedPath: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
    } as ILedgerAccount;
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(
      payableControlAccount
    );
    mockLedgerAccountRepo.findLatestBySubType.mockResolvedValueOnce(null);

    await getControlAccountScope<TPayablesLedgerCode>({
      ledgerAccountRepo: mockLedgerAccountRepo,
      accountingEntityId,
      controlAccountCode: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      repoOptions,
      validator,
    });

    expect(mockLedgerAccountRepo.findLatestBySubType).toHaveBeenCalledWith(
      accountingEntityId,
      ELedgerType.Liability,
      ELiabilitySubType.Payable,
      repoOptions
    );
  });

  it('throws when the control account cannot be found', async () => {
    const requestedControlAccountCode = '100010' as TCashLedgerCode;
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);

    await expect(
      getControlAccountScope<TCashLedgerCode>({
        ledgerAccountRepo: mockLedgerAccountRepo,
        accountingEntityId,
        controlAccountCode: requestedControlAccountCode,
        repoOptions,
        validator,
      })
    ).rejects.toMatchObject({
      errorKey:
        'ledger_error_asset_account_control_account_not_found_unexpected',
      cause: {
        controlAccountLedgerCode: requestedControlAccountCode,
      },
    });
    expect(validator).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });

  it('throws with control account context when the validator rejects the account', async () => {
    const requestedControlAccountCode = '100010' as TCashLedgerCode;
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(controlAccount);
    validator.mockReturnValueOnce(false);

    await expect(
      getControlAccountScope<TCashLedgerCode>({
        ledgerAccountRepo: mockLedgerAccountRepo,
        accountingEntityId,
        controlAccountCode: requestedControlAccountCode,
        repoOptions,
        validator,
      })
    ).rejects.toMatchObject({
      errorKey: 'ledger_error_asset_account_control_account_invalid',
      cause: {
        controlAccountId,
        controlAccountLedgerCode: requestedControlAccountCode,
        type: controlAccount.type,
        subType: controlAccount.subType,
        isControlAccount: controlAccount.isControlAccount,
      },
    });
    expect(validator).toHaveBeenCalledWith(controlAccount);
    expect(mockLedgerAccountRepo.findLatestBySubType).not.toHaveBeenCalled();
  });
});
