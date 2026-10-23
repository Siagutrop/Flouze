import { Global, Module } from '@nestjs/common';
import { Subject, filter } from 'rxjs';
import { Injectable } from '@nestjs/common';

export interface EventPayload {
  type: 'changed' | 'envelope_alert';
  envelopeName?: string;
  available?: string;
  scope?: 'household' | 'personal';
}

export interface HouseholdEvent {
  householdId: string;
  at: number;
  payload?: EventPayload;
}

/** Bus d'événements par foyer pour le rafraîchissement temps réel (SSE). */
@Injectable()
export class RealtimeService {
  private bus = new Subject<HouseholdEvent>();

  emit(householdId: string, payload?: EventPayload) {
    this.bus.next({ householdId, at: Date.now(), payload });
  }

  forHousehold(householdId: string) {
    return this.bus.pipe(filter((e) => e.householdId === householdId));
  }
}

@Global()
@Module({ providers: [RealtimeService], exports: [RealtimeService] })
export class RealtimeModule {}
