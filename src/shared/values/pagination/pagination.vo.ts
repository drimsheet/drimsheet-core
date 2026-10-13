import numberUtils from '@shared/utils/number';
import {
  EPaginationSortDirection,
  IPaginatedResponse,
  IPaginationParams,
  IPaginationResponseMeta,
  UPaginationSortDirection,
} from '@shared/values/pagination/types/pagination.types';

import paginationError from './pagination.error';

function getLimit(limit?: number): number {
  if (!limit) {
    return 10;
  }

  numberUtils.validateInteger(limit, paginationError.InvalidLimit);

  return limit > 200 ? 200 : limit;
}

function getOffset(offset?: number): number {
  if (!offset) {
    return 0;
  }

  numberUtils.validateInteger(offset, paginationError.InvalidOffset);

  return offset > 2000 ? 2000 : offset;
}

function getPage(limit: number, offset: number): number {
  numberUtils.validateNonNegativeNumber(limit, paginationError.InvalidLimit);
  numberUtils.validateNonNegativeNumber(offset, paginationError.InvalidOffset);

  const page = Math.floor(offset / limit) + 1;

  return page;
}

function pageToOffset(page?: number, limit?: number): number {
  const resolvedPage = page && page > 0 ? page : 1;
  const resolvedLimit = getLimit(limit);

  return (resolvedPage - 1) * resolvedLimit;
}

function getResponseMeta(
  total: number,
  params: IPaginationParams
): IPaginationResponseMeta {
  const limit = getLimit(params.limit);
  const offset = getOffset(params.offset);
  const page = getPage(limit, offset);
  const totalPages = Math.ceil(total / limit);

  return Object.freeze({
    page,
    limit,
    total,
    totalPages,
  });
}

function getPaginatedResponse<T>(
  data: T[],
  total: number,
  params: IPaginationParams
): IPaginatedResponse<T> {
  const meta = getResponseMeta(total, params);
  return Object.freeze({
    data,
    meta,
  });
}

function getSortDirection(
  direction?: UPaginationSortDirection
): UPaginationSortDirection {
  return direction ?? EPaginationSortDirection.Desc;
}

const paginationValue = Object.freeze({
  getLimit,
  getOffset,
  getPage,
  pageToOffset,
  getResponseMeta,
  getPaginatedResponse,
  getSortDirection,
});

export default paginationValue;
