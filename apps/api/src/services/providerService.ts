import { Provider, type IProvider } from '../models/Provider.js';
import { Lead, type ILead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { CreateLead } from '@fitolink/shared';

/**
 * Marketplace provider directory + lead capture.
 *
 * Pilots are kept in the User collection (role='pilot') and surfaced via
 * `marketplaceService.listPilots`. Everything in this file deals with the
 * non-login providers (distributors, agronomists, cooperatives) and the
 * leads they generate.
 */

export async function listProviders(): Promise<IProvider[]> {
  return Provider.find({ isVerified: true })
    .sort({ category: 1, name: 1 })
    .lean<IProvider[]>();
}

export async function createLead(userId: string, data: CreateLead): Promise<ILead> {
  const provider = await Provider.findById(data.providerId).lean();
  if (!provider) throw AppError.notFound('Proveedor');

  const user = await User.findById(userId).lean();
  if (!user) throw AppError.notFound('Usuario');

  const lead = await Lead.create({
    providerId: provider._id,
    fromUserId: user._id,
    type: data.type,
    status: 'new',
    message: data.message,
    fromUserSnapshot: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
  return lead;
}
