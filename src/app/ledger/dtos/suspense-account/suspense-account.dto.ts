export interface ICreateSuspenseAccountDto {
  name: string;
  type: 'asset' | 'liability';
  currencyCode: string;
}
