export type TAppContextWithRequiredKeys<
  TContext extends object,
  K extends keyof TContext,
> = TContext & Required<Pick<TContext, K>>;

export default interface IAppContextService<TContext extends object> {
  init<T>(store: TContext, callback: () => T): T;
  get<K extends keyof TContext = never>(
    requiredKeys?: readonly K[]
  ): TAppContextWithRequiredKeys<TContext, K>;
  set: (store: Partial<TContext>) => void;
}
