export interface IRecommendedBootstrapAccountDto {
  key: string;
  name: string;
  type: string;
  subType: string;
  behavior: string;
  isControlAccount: boolean;
  controlAccountCode?: string;
  controlAccountKey?: string;
  meta?: null;
}

export interface IRecommendedBootstrapAccountHeaderDto extends IRecommendedBootstrapAccountDto {
  sub: IRecommendedBootstrapAccountDto[];
}

export interface IRecommendedBootstrapDto {
  receivables: IRecommendedBootstrapAccountHeaderDto[];
  payables: IRecommendedBootstrapAccountHeaderDto[];
  revenue: IRecommendedBootstrapAccountHeaderDto[];
  expense: IRecommendedBootstrapAccountHeaderDto[];
  suspense: IRecommendedBootstrapAccountHeaderDto[];
}
