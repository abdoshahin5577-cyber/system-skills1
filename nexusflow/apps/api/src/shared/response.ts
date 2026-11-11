import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(res: Response, data: T, options: { status?: number; meta?: PageMeta } = {}) {
  const body: { success: true; data: T; meta?: PageMeta } = { success: true, data };
  if (options.meta) body.meta = options.meta;
  return res.status(options.status ?? 200).json(body);
}

export function buildPageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
