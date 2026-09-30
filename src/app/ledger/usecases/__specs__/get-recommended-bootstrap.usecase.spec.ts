import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';

describe('getRecommendedBootstrapUseCase', () => {
  const getRecommendations = makeGetRecommendedBootstrapUsecase();

  it('recommends only optional posting accounts beneath the established controls', () => {
    const response = getRecommendations();
    expect(Object.values(response).map((group) => group.length)).toEqual([
      1, 1, 6, 8, 2,
    ]);
    expect(response.receivables).toStrictEqual([
      {
        key: 'statutory-receivables-default',
        name: 'Statutory Receivables (Default)',
        type: 'asset',
        subType: 'receivables',
        behavior: 'statutory_receivable',
        isControlAccount: false,
        controlAccountCode: '102002',
      },
    ]);
    expect(response.payables).toStrictEqual([
      {
        key: 'statutory-payables-default',
        name: 'Statutory Payables (Default)',
        type: 'liability',
        subType: 'payable',
        behavior: 'tax_payable',
        isControlAccount: false,
        controlAccountCode: '201002',
        meta: null,
      },
    ]);
    expect(response.revenue[0]).toStrictEqual({
      key: 'services-default',
      name: 'Services (Default)',
      type: 'revenue',
      subType: 'services',
      behavior: 'services',
      isControlAccount: false,
      controlAccountCode: '401000',
    });
    const recommendations = Object.values(response).flat();
    expect(recommendations).toHaveLength(18);
    expect(recommendations.every((account) => !account.isControlAccount)).toBe(
      true
    );
    for (const account of recommendations) {
      expect(account).not.toHaveProperty('controlAccountKey');
      expect([
        'trade-receivables',
        'statutory-receivables',
        'trade-payables',
        'statutory-payables',
      ]).not.toContain(account.key);
    }
    expect(response.suspense.map((account) => account.type)).toEqual([
      'asset',
      'liability',
    ]);
  });

  it('returns flat account definitions within each group', () => {
    const response = getRecommendations();

    for (const group of Object.values(response)) {
      for (const account of group) {
        expect(account).not.toHaveProperty('sub');
        expect(account).not.toHaveProperty('controlAccountKey');
      }
    }
  });
});
