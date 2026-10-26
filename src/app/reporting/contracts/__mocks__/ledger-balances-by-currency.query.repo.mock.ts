import ILedgerBalancesByCurrencyQueryRepo from '@app/reporting/contracts/ledger-balances-by-currency.query.repo.contract';

const mockLedgerBalancesByCurrencyQueryRepo: jest.Mocked<ILedgerBalancesByCurrencyQueryRepo> =
  {
    findAll: jest.fn(),
  };

export default mockLedgerBalancesByCurrencyQueryRepo;
