import { Document, Types } from 'mongoose';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ'
}

export interface INotification {
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId;
  recipientPersonId?: Types.ObjectId;
  recipientUserId?: Types.ObjectId;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  sentAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationDocument = INotification & Document;
