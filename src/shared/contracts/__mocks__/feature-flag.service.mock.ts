import IFeatureFlagService from '@shared/contracts/feature-flag.service.contract';

const mockFeatureFlagService: jest.Mocked<IFeatureFlagService> = {
  isEnabled: jest.fn(),
};

export default mockFeatureFlagService;
