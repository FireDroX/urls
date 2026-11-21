export interface PageResponseDto<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
