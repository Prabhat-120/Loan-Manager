import { Schema, model } from 'mongoose';
import { INotification, NotificationChannel, NotificationStatus } from './notification.types.js';

const notificationSchema = new Schema<INotification>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    recipientPersonId: { type: Schema.Types.ObjectId, ref: 'Person' },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    channel: { type: String, enum: Object.values(NotificationChannel), required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING },
    sentAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook enforcing that at least one of recipientPersonId or recipientUserId is present
notificationSchema.pre('validate', function (next) {
  if (!this.recipientPersonId && !this.recipientUserId) {
    return next(new Error('Notification must have at least one recipient (recipientPersonId or recipientUserId)'));
  }
  next();
});

notificationSchema.index({ tenantId: 1, status: 1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
