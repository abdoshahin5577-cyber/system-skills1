import { Schema, model, type InferSchemaType } from 'mongoose';
import { PLAN_TIERS, SUBSCRIPTION_STATUSES } from '../../shared/constants';
import { baseOptions, oid } from '../../shared/schema';

/** One subscription per workspace. Billing history / processed webhook events: added in the billing phase. */
const subscriptionSchema = new Schema(
  {
    workspaceId: oid('Workspace', true),
    planTier: { type: String, enum: [...PLAN_TIERS], default: 'FREE', required: true },
    status: { type: String, enum: [...SUBSCRIPTION_STATUSES], default: 'ACTIVE', required: true },
    provider: { type: String, enum: ['STRIPE'] },
    providerCustomerId: String,
    providerSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    usage: {
      periodKey: { type: String }, // e.g. "2026-11"
      aiRequests: { type: Number, default: 0, min: 0 },
    },
  },
  baseOptions(),
);
subscriptionSchema.index({ workspaceId: 1 }, { unique: true });
subscriptionSchema.index({ providerSubscriptionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ providerCustomerId: 1 }, { sparse: true });

export type SubscriptionAttrs = InferSchemaType<typeof subscriptionSchema>;
export const Subscription = model('Subscription', subscriptionSchema);
