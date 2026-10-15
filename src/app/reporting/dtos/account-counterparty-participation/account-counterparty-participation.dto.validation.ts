import { paginationDtoValidation } from '@shared/values/pagination/dto/pagination.dto.validation';
import paginationError from '@shared/values/pagination/pagination.error';

export const getAccountCounterpartyParticipationQueryValidationSchema =
  paginationDtoValidation
    .pick({ page: true, limit: true, search: true })
    .extend({
      page: paginationDtoValidation.shape.page
        .unwrap()
        .int(new paginationError.InvalidOffset().errorKey)
        .optional(),
      limit: paginationDtoValidation.shape.limit
        .unwrap()
        .int(new paginationError.InvalidLimit().errorKey)
        .optional(),
    });
