export interface PlainError {
  code: number;
  message: string;
}

export function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  const code = (err as PlainError)?.code;
  let message =
    (err as PlainError)?.message ??
    (err as PromiseRejectedResult)?.reason ??
    (err as PlainError)?.toString() ??
    "未知错误";

  const retError = new Error(message);
  retError.code = code ?? 500;
  return retError;
}

export function formatError(e: unknown): Error {
  const error = toError(e);
  const message = error.message;
  const code = error.code;
  const retError = new Error(message);
  retError.code = code;

  // 处理常见的Windows错误
  if (
    message.includes("Access is denied") ||
    message.includes("拒绝访问") ||
    (code && code === -2147024891)
  ) {
    retError.message = "需要管理员权限，请以管理员身份运行程序";
  }

  return retError;
}

export function toPlainError(inputError: unknown): PlainError {
  const err = toError(inputError);
  return {
    code: err.code ?? 500,
    message: err.message || "未知错误, 请稍后再试",
  };
}

export function isPlainError(err: unknown): err is PlainError {
  return !!err && !!(err as PlainError).code && !!(err as PlainError).message;
}
