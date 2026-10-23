import IAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';

const mockAssetLiabilitySummaryQueryRepo: jest.Mocked<IAssetLiabilitySummaryQueryRepo> =
  {
    aggregate: jest.fn(),
  };

export default mockAssetLiabilitySummaryQueryRepo;
