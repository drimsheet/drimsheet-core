import { TEntityId } from '@shared/types/uuid';
import { TCreateAddressPayload } from '@shared/values/contact-details/address.vo';
import { IAddress } from '@shared/values/contact-details/types/address.types';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

export const ECounterpartyStatus = {
  Draft: 'draft',
  Active: 'active',
  Archived: 'archived',
} as const;

export type UCounterpartyStatus =
  (typeof ECounterpartyStatus)[keyof typeof ECounterpartyStatus];

export const ECounterpartyType = {
  Individual: 'individual',
  Organization: 'organization',
} as const;

export type UCounterpartyType =
  (typeof ECounterpartyType)[keyof typeof ECounterpartyType];

export const ECounterpartyRole = {
  Employer: 'employer',
  Vendor: 'vendor',
  Contractor: 'contractor',
} as const;

export type UCounterpartyRole =
  (typeof ECounterpartyRole)[keyof typeof ECounterpartyRole];

export interface ICounterparty {
  createdBy: TEntityId;
  id: TEntityId;
  accountingEntityId: TEntityId;
  name: string;
  status: UCounterpartyStatus;
  type: UCounterpartyType;
  roles: UCounterpartyRole[];
  meta: ICounterpartyMeta;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICounterpartyEmployerMeta {
  displayName: string | null;
  address: IAddress;
}

export interface ICounterpartyVendorMeta {
  address: IAddress | null;
}

export interface ICounterpartyContractorMeta {
  address: IAddress;
}

export interface ICounterpartyMeta {
  employer?: ICounterpartyEmployerMeta;
  vendor?: ICounterpartyVendorMeta;
  contractor?: ICounterpartyContractorMeta;
}

export type TCounterpartyRoleDetails = {
  [Role in UCounterpartyRole]: {
    role: Role;
    meta: NonNullable<ICounterpartyMeta[Role]>;
  };
}[UCounterpartyRole];

export interface IMakeCounterpartyPayload {
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  name: string;
  type: UCounterpartyType;
  status?: UCounterpartyStatus;
}

export interface ICreateCounterpartyEmployerMeta {
  displayName?: string | null;
  address: TCreateAddressPayload;
}

export interface ICreateCounterpartyVendorMeta {
  address?: TCreateAddressPayload | null;
}

export interface ICreateCounterpartyContractorMeta {
  address: TCreateAddressPayload;
}

export interface ICreateCounterpartyMeta {
  employer?: ICreateCounterpartyEmployerMeta;
  vendor?: ICreateCounterpartyVendorMeta;
  contractor?: ICreateCounterpartyContractorMeta;
}

export interface ICreateCounterpartyPayload extends IMakeCounterpartyPayload {
  meta?: ICreateCounterpartyMeta;
}

export interface IUpdateCounterpartyPayload {
  name?: string;
  type?: UCounterpartyType;
  status?: typeof ECounterpartyStatus.Active;
  meta?: ICreateCounterpartyMeta;
}

export type TAuditedCounterparty = TAuditedEntity<
  ICounterparty,
  ICounterparty,
  ICounterparty
>;
