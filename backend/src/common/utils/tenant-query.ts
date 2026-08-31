import { FilterQuery, Model } from 'mongoose';

export const findOneTenantScoped = async <T>(
  model: Model<T>,
  id: string,
  tenantId?: string
): Promise<T | null> => {
  const query: Record<string, unknown> = { _id: id };
  if (tenantId) {
    query.tenantId = tenantId;
  }
  return model.findOne(query as FilterQuery<T>);
};
