import IFeatureFlagAppService from '@app/context/contracts/services/feature-flag.service.contract';

const mockFeatureFlagAppService: jest.Mocked<IFeatureFlagAppService> = {
  canAccessAlpha1: jest.fn(),
};

export default mockFeatureFlagAppService;
