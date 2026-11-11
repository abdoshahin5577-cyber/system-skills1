import { Schema, model, type InferSchemaType } from 'mongoose';
import { PLAN_TIERS } from '../../shared/constants';
import { baseOptions } from '../../shared/schema';

/** Limits use -1 for "unlimited". Plans are seeded data, not user-editable. */
const planSchema = new Schema(
  {
    tier: { type: String, enum: [...PLAN_TIERS], required: true, unique: true },
    name: { type: String, required: true },
    priceMonthlyCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd', lowercase: true },
    providerPriceId: String, // e.g. Stripe price id (test mode)
    limits: {
      members: { type: Number, required: true },
      projects: { type: Number, required: true },
      storageMb: { type: Number, required: true },
      aiRequestsPerMonth: { type: Number, required: true },
    },
    active: { type: Boolean, default: true },
  },
  baseOptions(),
);

export type PlanAttrs = InferSchemaType<typeof planSchema>;
export const Plan = model('Plan', planSchema);
