import { asc, desc } from 'drizzle-orm';

import {
  EPaginationSortDirection,
  UPaginationSortDirection,
} from '@shared/values/pagination/types/pagination.types';

/**
 * Selects the Drizzle sort function, defaulting to descending order.
 */
export default function getDrizzleSortDirectionHelper(
  direction?: UPaginationSortDirection
) {
  return direction === EPaginationSortDirection.Asc ? asc : desc;
}
