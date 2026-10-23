import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 * Règle de visibilité : ownerId null = bien du foyer (tous les membres),
 * ownerId = user.id = bien personnel (lui seul).
 */
export function visibleTo(user: User) {
  return { OR: [{ ownerId: null }, { ownerId: user.id }] };
}

interface Owned {
  ownerId: string | null;
}

/**
 * Vérifie qu'un membre peut voir/modifier une entité.
 * 404 (pas 403) pour ne pas révéler l'existence des données d'autrui.
 */
export function assertAccess(entity: Owned | null | undefined, user: User) {
  if (!entity || (entity.ownerId !== null && entity.ownerId !== user.id)) {
    throw new NotFoundException('errors.notFound');
  }
}
