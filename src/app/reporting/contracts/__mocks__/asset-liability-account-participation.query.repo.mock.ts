import IAssetLiabilityAccountParticipationQueryRepo from '@app/reporting/contracts/asset-liability-account-participation.query.repo.contract';

const mockAssetLiabilityAccountParticipationQueryRepo: jest.Mocked<IAssetLiabilityAccountParticipationQueryRepo> =
  {
    findAll: jest.fn(),
  };

export default mockAssetLiabilityAccountParticipationQueryRepo;
