import { Types } from 'mongoose';
import { PersonModel } from './person.model.js';
import { PersonType, PersonStatus, PersonIdType } from './person.types.js';
import { normalizePhone } from '../../common/utils/phone.js';
import { TenantModel } from '../tenants/tenant.model.js';
import { UserModel } from '../users/user.model.js';
import { SubscriptionLimitService } from '../tenants/subscription.service.js';
import { AuditLogModel } from '../audit/audit-log.model.js';
import { AuditAction, AuditScope } from '../audit/audit-log.types.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError
} from '../../common/errors/app-error.js';
import { formatPersonDTO } from '../../common/utils/dto.js';

export interface CreatePersonInput {
  type?: PersonType;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  idType?: string;
  idNumber?: string;
  address?: Record<string, string>;
  dateOfBirth?: string | Date;
  occupation?: string;
  notes?: string;
}

export interface LookupOrCreatePersonInput {
  phone: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  idType?: string;
  idNumber?: string;
}

export interface UpdatePersonInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  organizationName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  idType?: PersonIdType;
  idNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  dateOfBirth?: string | Date;
  occupation?: string;
  notes?: string;
}

export class PersonService {
  /**
   * Helper to fetch tenant country context for phone normalization
   */
  private static async getTenantCountry(tenantId: string | Types.ObjectId): Promise<string> {
    const tenant = await TenantModel.findById(tenantId);
    return tenant?.country || 'IN';
  }

  /**
   * Normal Create Person Endpoint (POST /tenant/persons)
   * Throws 409 Conflict if phone already exists within tenant.
   */
  static async createPerson(tenantId: string | Types.ObjectId, input: CreatePersonInput, creatorUserId?: string) {
    const defaultCountry = await this.getTenantCountry(tenantId);
    const normalized = normalizePhone(input.phone, defaultCountry);

    // Check duplicate phone in tenant
    const existing = await PersonModel.findOne({ tenantId, normalizedPhone: normalized });
    if (existing) {
      throw new ConflictError(`Person with phone number '${input.phone}' already exists in this tenant.`);
    }

    // Check subscription limit before creation
    const limitCheck = await SubscriptionLimitService.checkPersonLimit(tenantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenError(
        `Tenant has reached maximum person limit (${limitCheck.max}). Upgrade subscription plan to add more people.`
      );
    }

    const type = input.type || PersonType.INDIVIDUAL;

    try {
      const person = await PersonModel.create({
        tenantId: new Types.ObjectId(tenantId),
        type,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        organizationName: input.organizationName,
        email: input.email || undefined,
        phone: input.phone,
        normalizedPhone: normalized,
        alternatePhone: input.alternatePhone,
        idType: input.idType as PersonIdType,
        idNumber: input.idNumber,
        address: input.address,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        occupation: input.occupation,
        notes: input.notes,
        status: PersonStatus.ACTIVE
      });

      await AuditLogModel.create({
        scope: AuditScope.TENANT,
        tenantId: new Types.ObjectId(tenantId),
        userId: creatorUserId ? new Types.ObjectId(creatorUserId) : undefined,
        action: AuditAction.CREATE,
        entity: 'Person',
        entityId: person._id.toString(),
        changes: { displayName: person.displayName, phone: person.phone }
      });

      return formatPersonDTO(person);
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; message?: string };
      if (mongoErr?.code === 11000 || mongoErr?.message?.includes('E11000')) {
        throw new ConflictError(`Person with phone number '${input.phone}' already exists in this tenant.`);
      }
      throw err;
    }
  }

  /**
   * Lookup-or-Create Person Endpoint (POST /tenant/persons/lookup-or-create)
   * Safely returns existing Person without consuming a slot, or inserts new Person with E11000 race condition recovery.
   */
  static async lookupOrCreatePerson(
    tenantId: string | Types.ObjectId,
    input: LookupOrCreatePersonInput,
    creatorUserId?: string
  ) {
    const defaultCountry = await this.getTenantCountry(tenantId);
    const normalized = normalizePhone(input.phone, defaultCountry);

    // 1. Search existing
    const existing = await PersonModel.findOne({ tenantId, normalizedPhone: normalized });
    if (existing) {
      let linkedEmail: string | undefined;
      if (existing.userId) {
        const u = await UserModel.findById(existing.userId);
        linkedEmail = u?.email;
      }
      return { created: false, person: formatPersonDTO(existing, linkedEmail) };
    }

    // 2. Enforce subscription limit ONLY for new creation
    const limitCheck = await SubscriptionLimitService.checkPersonLimit(tenantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenError(
        `Tenant has reached maximum person limit (${limitCheck.max}). Upgrade subscription plan to add more people.`
      );
    }

    try {
      const newPerson = await PersonModel.create({
        tenantId: new Types.ObjectId(tenantId),
        type: input.organizationName ? PersonType.ORGANIZATION : PersonType.INDIVIDUAL,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        organizationName: input.organizationName,
        email: input.email || undefined,
        phone: input.phone,
        normalizedPhone: normalized,
        idType: input.idType as PersonIdType,
        idNumber: input.idNumber,
        status: PersonStatus.ACTIVE
      });

      await AuditLogModel.create({
        scope: AuditScope.TENANT,
        tenantId: new Types.ObjectId(tenantId),
        userId: creatorUserId ? new Types.ObjectId(creatorUserId) : undefined,
        action: AuditAction.CREATE,
        entity: 'Person',
        entityId: newPerson._id.toString(),
        changes: { displayName: newPerson.displayName, phone: newPerson.phone }
      });

      return { created: true, person: formatPersonDTO(newPerson) };
    } catch (err: unknown) {
      // 3. Race condition recovery on duplicate key error (E11000)
      const mongoErr = err as { code?: number; message?: string };
      if (mongoErr?.code === 11000 || mongoErr?.message?.includes('E11000')) {
        const concurrentPerson = await PersonModel.findOne({ tenantId, normalizedPhone: normalized });
        if (concurrentPerson) {
          return { created: false, person: formatPersonDTO(concurrentPerson) };
        }
      }
      throw err;
    }
  }

  /**
   * List & Search Persons with tenant isolation, filters, sorting, and pagination
   */
  static async listPersons(
    tenantId: string | Types.ObjectId,
    query: {
      search?: string;
      phone?: string;
      email?: string;
      status?: PersonStatus;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };

    if (query.status && Object.values(PersonStatus).includes(query.status)) {
      filter.status = query.status;
    }

    if (query.phone) {
      try {
        const defaultCountry = await this.getTenantCountry(tenantId);
        filter.normalizedPhone = normalizePhone(query.phone, defaultCountry);
      } catch {
        filter.phone = new RegExp(query.phone, 'i');
      }
    }

    if (query.email) {
      filter.email = new RegExp(query.email, 'i');
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { displayName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { normalizedPhone: searchRegex }
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [persons, total] = await Promise.all([
      PersonModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      PersonModel.countDocuments(filter)
    ]);

    // Populate linked user emails
    const formattedPersons = await Promise.all(
      persons.map(async (p) => {
        let linkedEmail: string | undefined;
        if (p.userId) {
          const user = await UserModel.findById(p.userId);
          linkedEmail = user?.email;
        }
        return formatPersonDTO(p, linkedEmail);
      })
    );

    return {
      persons: formattedPersons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single Person details by ID with tenant isolation
   */
  static async getPersonById(tenantId: string | Types.ObjectId, personId: string) {
    const person = await PersonModel.findOne({ _id: personId, tenantId: new Types.ObjectId(tenantId) });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    let linkedEmail: string | undefined;
    if (person.userId) {
      const user = await UserModel.findById(person.userId);
      linkedEmail = user?.email;
    }

    return formatPersonDTO(person, linkedEmail);
  }

  /**
   * Update Person details
   */
  static async updatePerson(
    tenantId: string | Types.ObjectId,
    personId: string,
    updates: UpdatePersonInput,
    updatedByUserId?: string
  ) {
    const person = await PersonModel.findOne({ _id: personId, tenantId: new Types.ObjectId(tenantId) });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    if (updates.firstName !== undefined) person.firstName = updates.firstName;
    if (updates.middleName !== undefined) person.middleName = updates.middleName;
    if (updates.lastName !== undefined) person.lastName = updates.lastName;
    if (updates.organizationName !== undefined) person.organizationName = updates.organizationName;
    if (updates.email !== undefined) person.email = updates.email || undefined;
    if (updates.alternatePhone !== undefined) person.alternatePhone = updates.alternatePhone;
    if (updates.idType !== undefined) person.idType = updates.idType;
    if (updates.idNumber !== undefined) person.idNumber = updates.idNumber;
    if (updates.address !== undefined) person.address = { ...person.address, ...updates.address };
    if (updates.dateOfBirth !== undefined) person.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : undefined;
    if (updates.occupation !== undefined) person.occupation = updates.occupation;
    if (updates.notes !== undefined) person.notes = updates.notes;

    if (updates.phone && updates.phone !== person.phone) {
      const defaultCountry = await this.getTenantCountry(tenantId);
      const newNormalized = normalizePhone(updates.phone, defaultCountry);

      const existingPhone = await PersonModel.findOne({
        _id: { $ne: person._id },
        tenantId: new Types.ObjectId(tenantId),
        normalizedPhone: newNormalized
      });
      if (existingPhone) {
        throw new ConflictError(`Phone number '${updates.phone}' is already in use by another person in this tenant.`);
      }

      person.phone = updates.phone;
      person.normalizedPhone = newNormalized;
    }

    await person.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: new Types.ObjectId(tenantId),
      userId: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
      action: AuditAction.UPDATE,
      entity: 'Person',
      entityId: person._id.toString(),
      changes: updates
    });

    let linkedEmail: string | undefined;
    if (person.userId) {
      const user = await UserModel.findById(person.userId);
      linkedEmail = user?.email;
    }

    return formatPersonDTO(person, linkedEmail);
  }

  /**
   * Update Person Status (ACTIVE / INACTIVE)
   */
  static async updatePersonStatus(
    tenantId: string | Types.ObjectId,
    personId: string,
    newStatus: PersonStatus,
    updatedByUserId?: string
  ) {
    const person = await PersonModel.findOne({ _id: personId, tenantId: new Types.ObjectId(tenantId) });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    const previousStatus = person.status;
    person.status = newStatus;
    await person.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: new Types.ObjectId(tenantId),
      userId: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
      action: AuditAction.STATUS_CHANGE,
      entity: 'PersonStatus',
      entityId: person._id.toString(),
      changes: { previousStatus, newStatus }
    });

    return formatPersonDTO(person);
  }

  /**
   * Transactionally Link Person ↔ User
   */
  static async linkPersonToUser(
    tenantId: string | Types.ObjectId,
    personId: string,
    userId: string,
    actionByUserId?: string
  ) {
    const person = await PersonModel.findOne({ _id: personId, tenantId: new Types.ObjectId(tenantId) });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }
    if (person.userId) {
      throw new BadRequestError('Person is already linked to a User account.');
    }

    const user = await UserModel.findOne({ _id: userId, tenantId: new Types.ObjectId(tenantId) });
    if (!user) {
      throw new NotFoundError('User not found in this tenant');
    }
    if (user.personId) {
      throw new BadRequestError('User is already linked to a Person record.');
    }

    // Atomic 1-to-1 link
    person.userId = user._id;
    await person.save();

    user.personId = person._id;
    await user.save();

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: new Types.ObjectId(tenantId),
      userId: actionByUserId ? new Types.ObjectId(actionByUserId) : undefined,
      action: AuditAction.UPDATE,
      entity: 'PersonUserLink',
      entityId: person._id.toString(),
      changes: { linkedUserId: user._id.toString(), userEmail: user.email }
    });

    return formatPersonDTO(person, user.email);
  }

  /**
   * Transactionally Unlink Person ↔ User (TENANT_OWNER ONLY)
   */
  static async unlinkPersonFromUser(
    tenantId: string | Types.ObjectId,
    personId: string,
    actionByUserId?: string
  ) {
    const person = await PersonModel.findOne({ _id: personId, tenantId: new Types.ObjectId(tenantId) });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }
    if (!person.userId) {
      throw new BadRequestError('Person is not linked to any User account.');
    }

    const linkedUserId = person.userId;
    const user = await UserModel.findOne({ _id: linkedUserId, tenantId: new Types.ObjectId(tenantId) });

    person.userId = undefined;
    await person.save();

    if (user) {
      user.personId = undefined;
      await user.save();
    }

    await AuditLogModel.create({
      scope: AuditScope.TENANT,
      tenantId: new Types.ObjectId(tenantId),
      userId: actionByUserId ? new Types.ObjectId(actionByUserId) : undefined,
      action: AuditAction.UPDATE,
      entity: 'PersonUserUnlink',
      entityId: person._id.toString(),
      changes: { unlinkedUserId: linkedUserId.toString() }
    });

    return formatPersonDTO(person);
  }

  /**
   * Paginated Audit Logs for Person
   */
  static async getPersonAuditLogs(
    tenantId: string | Types.ObjectId,
    personId: string,
    query: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter = {
      tenantId: new Types.ObjectId(tenantId),
      entity: { $in: ['Person', 'PersonStatus', 'PersonUserLink', 'PersonUserUnlink'] },
      entityId: personId
    };

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLogModel.countDocuments(filter)
    ]);

    return {
      auditLogs: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}
