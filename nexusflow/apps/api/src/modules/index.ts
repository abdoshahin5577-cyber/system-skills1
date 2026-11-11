import { ActivityLog } from './activity/activityLog.model';
import { RefreshToken } from './auth/refreshToken.model';
import { Plan } from './billing/plan.model';
import { Subscription } from './billing/subscription.model';
import { Comment } from './comments/comment.model';
import { Conversation } from './conversations/conversation.model';
import { Attachment } from './files/attachment.model';
import { Invitation } from './invitations/invitation.model';
import { Membership } from './memberships/membership.model';
import { Message } from './messages/message.model';
import { Notification } from './notifications/notification.model';
import { Project } from './projects/project.model';
import { Sprint } from './sprints/sprint.model';
import { Task } from './tasks/task.model';
import { User } from './users/user.model';
import { Workspace } from './workspaces/workspace.model';

export {
  ActivityLog, Attachment, Comment, Conversation, Invitation, Membership, Message, Notification,
  Plan, Project, RefreshToken, Sprint, Subscription, Task, User, Workspace,
};

/** Every model whose documents belong to exactly one workspace. Enforced by tests/tenancy.schema.test.ts. */
export const tenantModels = [
  ActivityLog, Attachment, Comment, Conversation, Invitation, Membership, Message,
  Notification, Project, Sprint, Subscription, Task,
];

/** Global (not tenant-scoped) models. */
export const globalModels = [Plan, RefreshToken, User, Workspace];
