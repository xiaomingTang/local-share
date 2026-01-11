declare global {
  interface Error {
    cause?: Error;
    code?: number;
    message: string;
    stderr?: string;
    stdout?: string;
  }

  type Func<Args extends unknown[] = unknown[], T = unknown> = (
    ...args: Args
  ) => T;
}

export {};
