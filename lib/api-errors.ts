export const validationFailed = (message: string) =>
  Response.json({ code: "validation_failed", message }, { status: 400 });

export const notFound = (message: string) =>
  Response.json({ code: "not_found", message }, { status: 404 });

export const internalError = () =>
  Response.json(
    { code: "internal_error", message: "Something went wrong" },
    { status: 500 },
  );
