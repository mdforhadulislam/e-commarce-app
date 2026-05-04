import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";

interface ErrorResponse {
  message: string;
  stack: string | null;
}

const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  } as ErrorResponse);
};

export { errorHandler };
