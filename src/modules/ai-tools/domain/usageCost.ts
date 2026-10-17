import { z } from 'zod';
import { modelNameSchema } from './model';
export const pricesSchema = z.record(
  modelNameSchema,
  z.object({
    inputPerMillion: z.number().finite().nonnegative().max(1000000),
    outputPerMillion: z.number().finite().nonnegative().max(1000000),
  }),
);
export type ReportedUsage = {
  model: string;
  usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
};
export function usageCost(requests: ReportedUsage[], raw?: string) {
  let prices: ReturnType<typeof pricesSchema.parse>;
  try {
    prices = pricesSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return null;
  }
  if (
    !requests.length ||
    requests.some(
      ({ model, usage }) =>
        !prices[model] ||
        usage?.promptTokenCount === undefined ||
        usage?.candidatesTokenCount === undefined,
    )
  )
    return null;
  return {
    amount: requests.reduce(
      (total, { model, usage }) =>
        total +
        ((usage?.promptTokenCount ?? 0) * prices[model].inputPerMillion +
          (usage?.candidatesTokenCount ?? 0) * prices[model].outputPerMillion) /
          1000000,
      0,
    ),
    currency: 'USD',
    basis: 'provider-reported tokens; user-configured prices',
    excludesUnreportedRequests: true,
  };
}
export function totalUsage(requests: ReportedUsage[]) {
  if (!requests.some((r) => r.usage)) return null;
  const total: Record<string, number> = {};
  for (const field of ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount'] as const)
    if (requests.every((r) => r.usage?.[field] !== undefined))
      total[field] = requests.reduce((count, r) => count + (r.usage?.[field] ?? 0), 0);
  return total;
}
