export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> { data: T; }
export interface PaginatedResponse<T> { data: T[]; pagination: Pagination; }
export interface ApiErrorBody { error: { code: string; message: string; details: unknown | null }; }

export interface ApiProblem {
  code: string;
  message: string;
}
