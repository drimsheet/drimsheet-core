import { TEntityId } from '@shared/types/uuid';

import bankAccountMapper from '@infra/persistence/repos/ledger/mappers/bank-account.mapper';

describe('bankAccountMapper', () => {
  const ledgerAccountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

  const domainValue = {
    countryCode: 'NG',
    bankName: 'Guaranty Trust Bank',
    accountName: 'Treasury Account',
    accountNumber: '0123456789',
  };

  it('maps domain bank value to repository model', () => {
    const result = bankAccountMapper.toRepo(
      ledgerAccountId,
      accountingEntityId,
      domainValue,
      'a1111111-1111-4111-8111-111111111111' as TEntityId
    );

    expect(result.ledgerAccountId).toBe(ledgerAccountId);
    expect(result.accountingEntityId).toBe(accountingEntityId);
    expect(result.bankName).toBe(domainValue.bankName);
    expect(result.accountNumber).toBe(domainValue.accountNumber);
    expect(result.accountName).toBe(domainValue.accountName);
    expect(result.countryCode).toBe(domainValue.countryCode);
  });

  it('maps bank updates without overwriting attribution or account ownership', () => {
    expect(bankAccountMapper.toUpdateRepo(domainValue)).toEqual({
      ...domainValue,
      updatedAt: expect.any(String),
    });
  });

  it('maps repository model back to domain bank value', () => {
    const model: Parameters<typeof bankAccountMapper.toDomain>[0] = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      bankName: 'Guaranty Trust Bank',
      accountNumber: '0123456789',
      accountName: 'Treasury Account',
      countryCode: 'NG',
      accountingEntityId,
      ledgerAccountId,
      createdAt: '2026-03-14T00:00:00.000Z',
      updatedAt: '2026-03-14T00:00:00.000Z',
    };

    const result = bankAccountMapper.toDomain(model);

    expect(result).toEqual(domainValue);
  });
});
