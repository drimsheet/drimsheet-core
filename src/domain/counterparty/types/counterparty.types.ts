import { TEntityId } from '@shared/types/uuid';
import { TCreateAddressPayload } from '@shared/values/contact-details/address.vo';
import { IAddress } from '@shared/values/contact-details/types/address.types';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { ICounterpartyAudit } from './counterparty-audit.types';

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
  roleDetails: ICounterpartyRoleDetails;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICounterpartyEmployerDetails {
  displayName: string | null;
  address: IAddress;
}

export interface ICounterpartyVendorDetails {
  address: IAddress | null;
}

export interface ICounterpartyContractorDetails {
  address: IAddress;
}

export interface ICounterpartyRoleDetails {
  employer?: ICounterpartyEmployerDetails;
  vendor?: ICounterpartyVendorDetails;
  contractor?: ICounterpartyContractorDetails;
}

export type TCounterpartyRoleDetails = {
  [Role in UCounterpartyRole]: {
    role: Role;
    roleDetails: NonNullable<ICounterpartyRoleDetails[Role]>;
  };
}[UCounterpartyRole];

export interface IMakeCounterpartyPayload {
  createdBy: TEntityId;
  accountingEntityId: TEntityId;
  name: string;
  type: UCounterpartyType;
  status?: UCounterpartyStatus;
}

export interface ICreateCounterpartyEmployerDetails {
  displayName?: string | null;
  address: TCreateAddressPayload;
}

export interface ICreateCounterpartyVendorDetails {
  address?: TCreateAddressPayload | null;
}

export interface ICreateCounterpartyContractorDetails {
  address: TCreateAddressPayload;
}

export interface ICreateCounterpartyRoleDetails {
  employer?: ICreateCounterpartyEmployerDetails;
  vendor?: ICreateCounterpartyVendorDetails;
  contractor?: ICreateCounterpartyContractorDetails;
}

export interface ICreateCounterpartyPayload extends IMakeCounterpartyPayload {
  roleDetails?: ICreateCounterpartyRoleDetails;
}

export interface IUpdateCounterpartyPayload {
  name?: string;
  type?: UCounterpartyType;
  status?: typeof ECounterpartyStatus.Active;
  roleDetails?: ICreateCounterpartyRoleDetails;
}

export type TAuditedCounterparty = TAuditedEntity<
  ICounterparty,
  ICounterparty,
  ICounterparty
>;

export type TCounterpartyUpdate = [
  ICounterparty,
  IEvent<ICounterparty>[],
  ICounterpartyAudit | null,
];
