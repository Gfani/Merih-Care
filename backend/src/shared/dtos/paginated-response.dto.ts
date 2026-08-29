export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export class PaginatedResponseDto<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], total: number, page = 1, limit = 10) {
    this.items = items;
    const totalPages = Math.ceil(total / limit) || 1;
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }
}
