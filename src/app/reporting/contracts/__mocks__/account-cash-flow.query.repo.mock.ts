import IAccountCashFlowQueryRepo from '@app/reporting/contracts/account-cash-flow.query.repo.contract';

const mockAccountCashFlowQueryRepo: jest.Mocked<IAccountCashFlowQueryRepo> = {
  aggregateByAccount: jest.fn(),
};

export default mockAccountCashFlowQueryRepo;
