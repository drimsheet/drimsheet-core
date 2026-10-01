import { ERepoLock, ITransactionContext } from '@shared/types/repo.types';
import repoError from '@shared/values/errors/repo.error';

import { postgres } from '@infra/config/postgres.config';
import getDbQuery from '@infra/persistence/helpers/get-db-query';

describe('getDbQuery', () => {
  it.each(Object.values(ERepoLock))(
    'requires a transaction for %s locks',
    (lock) => {
      expect(() =>
        getDbQuery({ correlationId: 'test-correlation-id', lock })
      ).toThrow(repoError.TransactionRequired);
    }
  );

  it('uses the supplied transaction for locking reads', () => {
    const tx: ITransactionContext = {};
    expect(
      getDbQuery({
        correlationId: 'test-correlation-id',
        tx,
        lock: ERepoLock.Update,
      })
    ).toBe(tx);
  });

  it('should return options.tx if provided', () => {
    const mockTx: ITransactionContext = {};
    const result = getDbQuery({
      tx: mockTx,
      correlationId: 'test-correlation-id',
    });
    expect(result).toBe(mockTx);
  });

  it('should return postgres if options.tx is not provided or undefined', () => {
    const result = getDbQuery({ correlationId: 'test-correlation-id' });
    expect(result).toBe(postgres);
  });
});
