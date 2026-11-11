export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export const SPRINT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const;
export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED'] as const;
export const PLAN_TIERS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE'] as const;
export const CONVERSATION_TYPES = ['CHANNEL', 'DIRECT', 'PROJECT'] as const;
export const ATTACHMENT_STATUSES = ['PENDING', 'READY', 'REJECTED'] as const;
export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_STATUS_CHANGED',
  'COMMENT_CREATED',
  'MENTION',
  'INVITATION',
  'PROJECT_UPDATED',
  'DEADLINE_APPROACHING',
] as const;
