/** Response types shared across the API. */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export type ServerDateTime = string;

export interface MessageResponse {
  message: string;
}
