export interface IFeatureFlagContext {
  email: string;
}

export default interface IFeatureFlagAppService {
  canAccessAlpha1(context: IFeatureFlagContext): Promise<boolean>;
}
