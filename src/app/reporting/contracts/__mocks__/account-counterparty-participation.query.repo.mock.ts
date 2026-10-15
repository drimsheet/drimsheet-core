import IAccountCounterpartyParticipationQueryRepo from '@app/reporting/contracts/account-counterparty-participation.query.repo.contract';

const mockAccountCounterpartyParticipationQueryRepo: jest.Mocked<IAccountCounterpartyParticipationQueryRepo> =
  {
    aggregateByAccount: jest.fn(),
  };

export default mockAccountCounterpartyParticipationQueryRepo;
