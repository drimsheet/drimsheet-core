import ILedgerAccountQueryRepo from '@app/ledger/contracts/ledger-account.query.repo.contract';

const mockLedgerAccountQueryRepo: jest.Mocked<ILedgerAccountQueryRepo> = {
  findChartOfAccounts: jest.fn(),
  findSubAccounts: jest.fn(),
};

export default mockLedgerAccountQueryRepo;
