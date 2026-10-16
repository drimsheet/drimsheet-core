import IAccountingContextQueryRepo from '@app/accounting/contracts/accounting-context.query.repo.contract';

const mockAccountingContextQueryRepo: jest.Mocked<IAccountingContextQueryRepo> =
  {
    findActiveByAccountingEntityId: jest.fn(),
  };

export default mockAccountingContextQueryRepo;
