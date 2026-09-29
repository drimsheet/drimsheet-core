export interface IRecommendedBootstrapAccountDto {
  key: string;
  name: string;
  type: string;
  subType: string;
  behavior: string;
  isControlAccount: boolean;
  controlAccountCode?: string;
  meta?: null;
}

export interface IRecommendedBootstrapDto {
  receivables: IRecommendedBootstrapAccountDto[];
  payables: IRecommendedBootstrapAccountDto[];
  revenue: IRecommendedBootstrapAccountDto[];
  expense: IRecommendedBootstrapAccountDto[];
  suspense: IRecommendedBootstrapAccountDto[];
}
