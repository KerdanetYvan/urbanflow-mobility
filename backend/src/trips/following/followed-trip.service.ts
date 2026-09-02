import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, MoreThan, Repository } from 'typeorm';
import type { StartFollowingTripDto } from './dto/start-following-trip.dto';
import { FollowedTrip } from './followed-trip.entity';

/**
 * Gere le trajet actuellement suivi par un utilisateur (issue #18) - voir
 * FollowedTrip pour le contrat RGPD et la regle "un seul suivi a la fois".
 */
@Injectable()
export class FollowedTripService {
  private readonly logger = new Logger(FollowedTripService.name);

  constructor(
    @InjectRepository(FollowedTrip)
    private readonly repository: Repository<FollowedTrip>,
  ) {}

  /**
   * Demarre le suivi d'un itineraire (POST /trips/current) - upsert par
   * userId (contrainte UNIQUE sur la colonne, voir FollowedTrip) : un
   * utilisateur qui suivait deja un trajet voit son suivi precedent
   * silencieusement remplace (docs/specs/f3-scoring-perturbations-suivi.md
   * section 2), pas d'erreur 409.
   */
  async startFollowing(
    userId: string,
    dto: StartFollowingTripDto,
  ): Promise<FollowedTrip> {
    const existing = await this.repository.findOneBy({ userId });

    const followedTrip = this.repository.create({
      ...(existing ? { id: existing.id } : {}),
      userId,
      originLat: dto.originLat,
      originLon: dto.originLon,
      originLabel: dto.originLabel ?? null,
      destinationLat: dto.destinationLat,
      destinationLon: dto.destinationLon,
      destinationLabel: dto.destinationLabel ?? null,
      segments: dto.segments,
      transportModes: dto.transportModes ?? null,
      endTime: new Date(dto.endTime),
      // Nouveau suivi = nouvelle perturbation potentielle a decouvrir,
      // jamais celle du suivi precedent.
      lastNotifiedDisruptionSignature: null,
    });

    return this.repository.save(followedTrip);
  }

  /** Le trajet actuellement suivi par cet utilisateur, `null` si aucun (GET /trips/current). */
  findCurrent(userId: string): Promise<FollowedTrip | null> {
    return this.repository.findOneBy({ userId });
  }

  /** Arrete le suivi (DELETE /trips/current) - idempotent, aucune erreur si rien n'etait suivi. */
  async stopFollowing(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }

  /**
   * Tous les suivis actifs (non expires, endTime dans le futur) - interroge
   * par TripDisruptionMonitorService a chaque cycle de detection. Filtre
   * ici (pas seulement via purgeExpired ci-dessous) : un suivi expire ne
   * doit plus jamais declencher de detection, sans attendre le prochain
   * passage de la purge quotidienne (jusqu'a pres de 24h de decalage sinon).
   */
  findAllActive(): Promise<FollowedTrip[]> {
    return this.repository.find({
      where: { endTime: MoreThan(new Date()) },
    });
  }

  /**
   * Enregistre la signature de la derniere perturbation notifiee pour ce
   * suivi (anti-spam, section 4 de la spec de cadrage) - appelee par
   * TripDisruptionMonitorService juste apres l'envoi d'une notification.
   */
  async recordNotifiedDisruption(
    followedTripId: string,
    signature: string,
  ): Promise<void> {
    await this.repository.update(
      { id: followedTripId },
      { lastNotifiedDisruptionSignature: signature },
    );
  }

  /**
   * Purge quotidienne des suivis expires (meme mecanique que
   * TripHistoryService#handleDailyPurge, issue #11) - un suivi n'a aucune
   * raison de persister au-dela de la fin theorique du trajet qu'il
   * suivait (section 5 de la spec de cadrage).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpired(): Promise<void> {
    const result = await this.repository.delete({
      endTime: LessThan(new Date()),
    });
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(
        `Purge des suivis de trajet expires : ${deleted} suivi(s) supprime(s)`,
      );
    }
  }
}
