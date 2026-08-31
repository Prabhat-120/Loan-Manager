import { Request, Response, NextFunction } from 'express';
import { PersonService } from './person.service.js';
import {
  createPersonSchema,
  updatePersonSchema,
  lookupOrCreatePersonSchema,
  updatePersonStatusSchema,
  queryPersonSchema
} from './person.validation.js';

export class PersonController {
  static async listPersons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = queryPersonSchema.parse(req.query);
      const data = await PersonService.listPersons(req.user!.tenantId!, {
        ...query,
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 10
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async lookupOrCreatePerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = lookupOrCreatePersonSchema.parse(req.body);
      const data = await PersonService.lookupOrCreatePerson(req.user!.tenantId!, validated, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createPerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createPersonSchema.parse(req.body);
      const data = await PersonService.createPerson(req.user!.tenantId!, validated, req.user?.id);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPersonById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PersonService.getPersonById(req.user!.tenantId!, req.params.personId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updatePerson(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePersonSchema.parse(req.body);
      const data = await PersonService.updatePerson(req.user!.tenantId!, req.params.personId, validated, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updatePersonStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updatePersonStatusSchema.parse(req.body);
      const data = await PersonService.updatePersonStatus(req.user!.tenantId!, req.params.personId, validated.status, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async linkPersonToUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.body;
      const data = await PersonService.linkPersonToUser(req.user!.tenantId!, req.params.personId, userId, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async unlinkPersonFromUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await PersonService.unlinkPersonFromUser(req.user!.tenantId!, req.params.personId, req.user?.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPersonAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const data = await PersonService.getPersonAuditLogs(req.user!.tenantId!, req.params.personId, { page, limit });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
