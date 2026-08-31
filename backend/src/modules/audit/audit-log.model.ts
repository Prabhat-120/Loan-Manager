import { Schema, model } from 'mongoose';
import { IAuditLog, AuditScope, AuditAction } from './audit-log.types.js';

const auditLogSchema = new Schema<IAuditLog>(
  {
    scope: { type: String, enum: Object.values(AuditScope), default: AuditScope.TENANT, required: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: function (this: IAuditLog) {
        return this.scope === AuditScope.TENANT;
      }
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    entity: { type: String, required: true, trim: true },
    entityId: { type: String, required: true, trim: true },
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

auditLogSchema.index({ tenantId: 1, scope: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
