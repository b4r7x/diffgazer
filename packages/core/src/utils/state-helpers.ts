export function createErrorState<TCode extends string = "INTERNAL_ERROR">(
  message: string,
  code: TCode = "INTERNAL_ERROR" as TCode
) {
  return { status: "error" as const, error: { message, code } };
}
