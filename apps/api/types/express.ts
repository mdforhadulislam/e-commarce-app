
import { Request } from 'express';

export interface PaginationQuery {
  page?: string;
  limit?: string;
  perPage?: string;
  sortOrder?: string;
  search?: string;
  [key: string]: any;
}

/**
 * Type-safe Request with specific Query parameters
 */
export interface RequestWithQuery<T> extends Request<any, any, any, T> {
  query: T;
}

export interface RequestWithBody<T> extends Request<any, any, T> {
  body: T;
}

export interface RequestWithBodyAndQuery<TBody, TQuery> extends Request<any, any, TBody, TQuery> {
  body: TBody;
  query: TQuery;
}

export interface RequestWithParams<TParams> extends Request<TParams> {
  params: TParams;
}

// Authenticated Request types
import { IUser } from "../models/userModel.js";

export interface AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user: IUser;
}

export interface AuthRequestWithBody<T> extends AuthenticatedRequest<any, any, T, any> {}
export interface AuthRequestWithQuery<T> extends AuthenticatedRequest<any, any, any, T> {}

