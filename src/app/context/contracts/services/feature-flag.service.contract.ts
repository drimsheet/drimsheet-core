import { IFeatureFlagContext } from '@shared/contracts/feature-flag.service.contract';

export default interface IFeatureFlagAppService {
  canAccessAlpha1(context: IFeatureFlagContext): Promise<boolean>;
}
