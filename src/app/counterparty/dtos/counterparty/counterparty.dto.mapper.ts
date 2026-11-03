import { TEntityId } from '@shared/types/uuid';
import { TCreateAddressPayload } from '@shared/values/contact-details/address.vo';
import { IAddressDto } from '@shared/values/contact-details/dto/address.dto';
import { IAddress } from '@shared/values/contact-details/types/address.types';

import {
  ICounterparty,
  ICreateCounterpartyPayload,
  ICreateCounterpartyRoleDetails,
  IUpdateCounterpartyPayload,
} from '@domain/counterparty/types/counterparty.types';

import {
  ICounterpartyCreateReq,
  ICounterpartyDto,
  ICounterpartyUpdateReq,
} from './counterparty.dto';

function fromAddressDto(address: IAddressDto): TCreateAddressPayload {
  return {
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
  };
}

function toAddressDto(address: IAddress): IAddressDto {
  return {
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    region: address.region ?? undefined,
    postalCode: address.postalCode ?? undefined,
    countryCode: address.countryCode,
  };
}

function fromRoleDetailsDto(
  input: ICounterpartyCreateReq['roleDetails']
): ICreateCounterpartyRoleDetails | undefined {
  let roleDetails: ICreateCounterpartyRoleDetails | undefined;
  if (input !== undefined) {
    roleDetails = {};
    if (input.employer) {
      roleDetails.employer = {
        displayName: input.employer.displayName,
        address: fromAddressDto(input.employer.address),
      };
    }
    if (input.vendor) {
      const address = input.vendor.address;
      roleDetails.vendor = {
        address: address == null ? address : fromAddressDto(address),
      };
    }
    if (input.contractor) {
      roleDetails.contractor = {
        address: fromAddressDto(input.contractor.address),
      };
    }
  }
  return roleDetails;
}

const counterpartyDtoMapper = {
  fromDto(
    payload: ICounterpartyCreateReq,
    accountingEntityId: TEntityId,
    createdBy: TEntityId
  ): ICreateCounterpartyPayload {
    const roleDetails = fromRoleDetailsDto(payload.roleDetails);
    return {
      accountingEntityId,
      createdBy,
      name: payload.name,
      type: payload.type,
      status: payload.status,
      roleDetails,
    };
  },
  fromUpdateDto(payload: ICounterpartyUpdateReq): IUpdateCounterpartyPayload {
    return {
      name: payload.name,
      type: payload.type,
      status: payload.status,
      roleDetails: fromRoleDetailsDto(payload.roleDetails),
    };
  },
  toDto(counterparty: ICounterparty): ICounterpartyDto {
    const roleDetails: ICounterpartyDto['roleDetails'] = {};
    if (counterparty.roleDetails.employer) {
      roleDetails.employer = {
        displayName: counterparty.roleDetails.employer.displayName,
        address: toAddressDto(counterparty.roleDetails.employer.address),
      };
    }
    if (counterparty.roleDetails.vendor) {
      roleDetails.vendor = {
        address:
          counterparty.roleDetails.vendor.address === null
            ? null
            : toAddressDto(counterparty.roleDetails.vendor.address),
      };
    }
    if (counterparty.roleDetails.contractor) {
      roleDetails.contractor = {
        address: toAddressDto(counterparty.roleDetails.contractor.address),
      };
    }
    return {
      id: counterparty.id,
      createdBy: counterparty.createdBy,
      accountingEntityId: counterparty.accountingEntityId,
      name: counterparty.name,
      status: counterparty.status,
      type: counterparty.type,
      roles: [...counterparty.roles],
      roleDetails,
      createdAt: counterparty.createdAt,
      updatedAt: counterparty.updatedAt,
    };
  },
};

export default Object.freeze(counterpartyDtoMapper);
