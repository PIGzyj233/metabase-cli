export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint: string,
    public retryable = false,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}
