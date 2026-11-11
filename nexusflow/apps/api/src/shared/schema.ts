import { Schema, type SchemaOptions } from 'mongoose';

/** ObjectId reference helper. */
export const oid = (ref: string, required = false) => ({
  type: Schema.Types.ObjectId,
  ref,
  required,
});

/** Shared schema options: timestamps + a JSON shape that exposes `id` and hides internals. */
export function baseOptions(): SchemaOptions {
  return {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash;
        delete ret.tokenHash;
        return ret;
      },
    },
  };
}
