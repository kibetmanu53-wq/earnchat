/** An error with an HTTP status code, safe to surface to API clients. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'app_error') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
