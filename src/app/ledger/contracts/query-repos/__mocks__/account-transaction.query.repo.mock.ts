import IAccountTransactionQueryRepo from '@app/ledger/contracts/query-repos/account-transaction.query.repo.contract';

const mockAccountTransactionQueryRepo: jest.Mocked<IAccountTransactionQueryRepo> =
  {
    findAllByAccountId: jest.fn(),
  };

export default mockAccountTransactionQueryRepo;
