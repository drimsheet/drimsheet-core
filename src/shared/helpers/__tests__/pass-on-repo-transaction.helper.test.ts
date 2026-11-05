import passOnRepoTransactionHelper from '@shared/helpers/pass-on-repo-transaction.helper';

describe('passOnRepoTransactionHelper', () => {
  it('should return a new object combining options and the transaction context', () => {
    const options = { correlationId: '123' } as any;
    const tx = { query: jest.fn() } as any;
    const result = passOnRepoTransactionHelper(options, tx);

    expect(result).toEqual({
      correlationId: '123',
      tx,
    });
  });

  it('should override tx in options if already present', () => {
    const originalTx = { query: jest.fn() } as any;
    const newTx = { query: jest.fn() } as any;
    const options = { correlationId: '123', tx: originalTx } as any;
    const result = passOnRepoTransactionHelper(options, newTx);

    expect(result.tx).toBe(newTx);
    expect(result.correlationId).toBe('123');
  });
});
