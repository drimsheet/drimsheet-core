import { TEntityId } from '@shared/types/uuid';
import { TCreateAddressPayload } from '@shared/values/contact-details/address.vo';
import { IAddressDto } from '@shared/values/contact-details/dto/address.dto';
import { IAddress } from '@shared/values/contact-details/types/address.types';

import {
  ICounterparty,
  ICreateCounterpartyMeta,
  ICreateCounterpartyPayload,
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

function fromMetaDto(
  input: ICounterpartyCreateReq['meta']
): ICreateCounterpartyMeta | undefined {
  let meta: ICreateCounterpartyMeta | undefined;
  if (input !== undefined) {
    meta = {};
    if (input.employer) {
      meta.employer = {
        displayName: input.employer.displayName,
        address: fromAddressDto(input.employer.address),
      };
    }
    if (input.vendor) {
      const address = input.vendor.address;
      meta.vendor = {
        address: address == null ? address : fromAddressDto(address),
      };
    }
    if (input.contractor) {
      meta.contractor = {
        address: fromAddressDto(input.contractor.address),
      };
    }
  }
  return meta;
}

const counterpartyDtoMapper = {
  fromDto(
    payload: ICounterpartyCreateReq,
    accountingEntityId: TEntityId,
    createdBy: TEntityId
  ): ICreateCounterpartyPayload {
    const meta = fromMetaDto(payload.meta);
    return {
      accountingEntityId,
      createdBy,
      name: payload.name,
      type: payload.type,
      status: payload.status,
      meta,
    };
  },
  fromUpdateDto(payload: ICounterpartyUpdateReq): IUpdateCounterpartyPayload {
    return {
      name: payload.name,
      type: payload.type,
      status: payload.status,
      meta: fromMetaDto(payload.meta),
    };
  },
  toDto(counterparty: ICounterparty): ICounterpartyDto {
    const meta: ICounterpartyDto['meta'] = {};
    if (counterparty.meta.employer)
      meta.employer = {
        displayName: counterparty.meta.employer.displayName,
        address: toAddressDto(counterparty.meta.employer.address),
      };
    if (counterparty.meta.vendor)
      meta.vendor = {
        address:
          counterparty.meta.vendor.address === null
            ? null
            : toAddressDto(counterparty.meta.vendor.address),
      };
    if (counterparty.meta.contractor)
      meta.contractor = {
        address: toAddressDto(counterparty.meta.contractor.address),
      };
    return {
      id: counterparty.id,
      createdBy: counterparty.createdBy,
      accountingEntityId: counterparty.accountingEntityId,
      name: counterparty.name,
      status: counterparty.status,
      type: counterparty.type,
      roles: [...counterparty.roles],
      meta,
      createdAt: counterparty.createdAt,
      updatedAt: counterparty.updatedAt,
    };
  },
};

export default Object.freeze(counterpartyDtoMapper);
