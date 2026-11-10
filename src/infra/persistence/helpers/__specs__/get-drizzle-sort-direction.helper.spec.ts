import { asc, desc } from 'drizzle-orm';

import {
  EPaginationSortDirection,
  UPaginationSortDirection,
} from '@shared/values/pagination/types/pagination.types';

import getDrizzleSortDirectionHelper from '@infra/persistence/helpers/get-drizzle-sort-direction.helper';

describe('getDrizzleSortDirectionHelper', () => {
  describe('getSortDirection', () => {
    it('returns asc function when direction is EPaginationSortDirection.Asc', () => {
      const result = getDrizzleSortDirectionHelper(
        EPaginationSortDirection.Asc
      );
      expect(result).toBe(asc);
    });

    it('returns desc function when direction is EPaginationSortDirection.Desc', () => {
      const result = getDrizzleSortDirectionHelper(
        EPaginationSortDirection.Desc
      );
      expect(result).toBe(desc);
    });

    it('defaults to desc function when direction is undefined', () => {
      const result = getDrizzleSortDirectionHelper();
      expect(result).toBe(desc);
    });

    it('defaults to desc function when direction is not Asc', () => {
      const result = getDrizzleSortDirectionHelper(
        'invalid' as UPaginationSortDirection
      );
      expect(result).toBe(desc);
    });
  });
});
