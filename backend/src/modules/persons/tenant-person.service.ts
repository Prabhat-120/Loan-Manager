import { Types } from 'mongoose';
import { PersonModel } from './person.model.js';
import { PersonType, PersonIdType } from './person.types.js';
import { normalizePhone } from '../../common/utils/phone.js';
import { UserModel } from '../users/user.model.js';
import { SubscriptionLimitService } from '../tenants/subscription.service.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { formatPersonDTO } from '../../common/utils/dto.js';

export interface LookupOrCreatePersonInput {
  phone: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  type?: PersonType;
  email?: string;
  idType?: PersonIdType;
  idNumber?: string;
}

export class TenantPersonService {
  /**
   * Phone lookup-or-create within tenant
   */
  static async lookupOrCreatePerson(tenantId: string | Types.ObjectId, input: LookupOrCreatePersonInput) {
    const normalized = normalizePhone(input.phone);
    const existingPerson = await PersonModel.findOne({ tenantId, normalizedPhone: normalized });

    if (existingPerson) {
      return { created: false, person: formatPersonDTO(existingPerson) };
    }

    // Enforce subscription limit before creating new Person
    const limitCheck = await SubscriptionLimitService.checkPersonLimit(tenantId);
    if (!limitCheck.allowed) {
      throw new ForbiddenError(`Tenant has reached maximum person limit (${limitCheck.max}). Upgrade plan to add more people.`);
    }

    const type = input.type || PersonType.INDIVIDUAL;
    const displayName = input.displayName || `${input.firstName || ''} ${input.lastName || ''}`.trim() || input.phone;

    const newPerson = await PersonModel.create({
      tenantId: new Types.ObjectId(tenantId),
      type,
      displayName,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      normalizedPhone: normalized,
      email: input.email,
      idType: input.idType,
      idNumber: input.idNumber
    });

    return { created: true, person: formatPersonDTO(newPerson) };
  }

  /**
   * Link an existing Person to a User account
   */
  static async linkPersonToUser(tenantId: string | Types.ObjectId, userId: string, personId: string) {
    const user = await UserModel.findOne({ _id: userId, tenantId });
    if (!user) {
      throw new NotFoundError('User not found in this tenant');
    }

    if (user.personId) {
      throw new BadRequestError('User is already linked to a Person record.');
    }

    const person = await PersonModel.findOne({ _id: personId, tenantId });
    if (!person) {
      throw new NotFoundError('Person not found in this tenant');
    }

    if (person.userId) {
      throw new BadRequestError('Person is already linked to another User account.');
    }

    // Atomic two-way link
    user.personId = person._id;
    await user.save();

    person.userId = user._id;
    await person.save();

    return {
      message: 'Person successfully linked to User',
      user: { id: user._id.toString(), email: user.email, personId: person._id.toString() },
      person: formatPersonDTO(person)
    };
  }
}
