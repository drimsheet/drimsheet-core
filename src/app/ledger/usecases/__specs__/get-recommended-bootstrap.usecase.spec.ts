import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';

describe('getRecommendedBootstrapUseCase', () => {
  const getRecommendations = makeGetRecommendedBootstrapUsecase();

  it('returns the catalog synchronously with statutory accounts nested under their parents', () => {
    const response = getRecommendations();

    expect(Object.values(response).map((group) => group.length)).toEqual([
      2, 2, 6, 8, 2,
    ]);
    expect(response.receivables[1].sub).toStrictEqual([
      {
        key: 'statutory-receivables-default',
        name: 'Statutory Receivables (Default)',
        type: 'asset',
        subType: 'receivables',
        behavior: 'statutory_receivable',
        isControlAccount: false,
        controlAccountKey: 'statutory-receivables',
      },
    ]);
    expect(response.receivables[1].key).toBe('statutory-receivables');
    expect(response.payables[1].sub).toStrictEqual([
      {
        key: 'statutory-payables-default',
        name: 'Statutory Payables (Default)',
        type: 'liability',
        subType: 'payable',
        behavior: 'tax_payable',
        isControlAccount: false,
        controlAccountKey: 'statutory-payables',
        meta: null,
      },
    ]);
    expect(response.payables[1].key).toBe('statutory-payables');
    expect(response.revenue[0]).toStrictEqual({
      key: 'services-default',
      name: 'Services (Default)',
      type: 'revenue',
      subType: 'services',
      behavior: 'services',
      isControlAccount: false,
      controlAccountCode: '401000',
      sub: [],
    });
    expect(response.receivables[0].sub).toEqual([]);
    expect(response.receivables[0]).not.toHaveProperty('meta');
    expect(response.payables[0].meta).toBeNull();
    expect(response.suspense.map((account) => account.type)).toEqual([
      'asset',
      'liability',
    ]);
  });

  it('includes sub arrays on every header and uses base account DTOs for children', () => {
    const response = getRecommendations();

    for (const group of Object.values(response)) {
      for (const header of group) {
        expect(Array.isArray(header.sub)).toBe(true);
        for (const child of header.sub) {
          expect(child).not.toHaveProperty('sub');
          expect(child.controlAccountKey).toBe(header.key);
        }
      }
    }
  });
});
