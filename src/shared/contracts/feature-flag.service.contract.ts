export interface IFeatureFlagContext {
  email: string;
}

export default interface IFeatureFlagService {
  isEnabled(
    flagKey: string,
    context: IFeatureFlagContext,
    defaultValue: boolean
  ): Promise<boolean>;
}
