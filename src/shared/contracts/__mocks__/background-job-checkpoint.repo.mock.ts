import IBackgroundJobCheckpointRepo from '@shared/contracts/background-job-checkpoint.repo';

const mockBackgroundJobCheckpointRepo: jest.Mocked<IBackgroundJobCheckpointRepo> =
  {
    getLastSucceededAt: jest.fn(),
    recordSuccess: jest.fn(),
  };

export default mockBackgroundJobCheckpointRepo;
