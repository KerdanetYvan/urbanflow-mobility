import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SearchTripsDto } from '../dto/search-trips.dto';
import type { TripHistoryEntryDto } from '../dto/trip-history-entry.dto';
import { TripHistoryEntry } from './trip-history-entry.entity';

/**
 * Fenetre de retention glissante de l'historique des trajets (issue #11),
 * confirmee a 12 mois par docs/specs/rgpd-geolocalisation.md section 3.1.
 * En jours plutot qu'en mois : evite toute ambiguite de calendrier
 * (nombre de jours variable selon les mois) dans le calcul de la purge.
 */
const TRIP_HISTORY_RETENTION_DAYS = 365;

/** Nombre maximum d'entrees distinctes (origine/destination) renvoyees par findRecent - voir sa docstring. */
const MAX_RECENT_ENTRIES = 10;

/**
 * Gere la persistance et la lecture de l'historique de recherche
 * d'itineraires (F2, issue #11) : enregistrement d'une recherche
 * (TripsService#search l'appelle quand un utilisateur authentifie est
 * connu), lecture dedupliquee pour GET /trips/history, et purge
 * automatique des entrees perimees (RGPD, docs/specs/rgpd-geolocalisation.md
 * section 3.1).
 */
@Injectable()
export class TripHistoryService {
  private readonly logger = new Logger(TripHistoryService.name);

  constructor(
    @InjectRepository(TripHistoryEntry)
    private readonly historyRepository: Repository<TripHistoryEntry>,
  ) {}

  /**
   * Enregistre une recherche effectuee par un utilisateur authentifie.
   * Ecriture en append-only (voir TripHistoryEntry) : une ligne de plus a
   * chaque appel, jamais de mise a jour d'une ligne existante.
   *
   * Avale volontairement toute erreur (loggee, jamais relancee) : la
   * persistance de l'historique est une fonctionnalite secondaire, elle ne
   * doit jamais faire echouer une recherche d'itineraire (fonctionnalite
   * principale, voir TripsService#search) meme en cas de panne DB.
   */
  async record(userId: string, dto: SearchTripsDto): Promise<void> {
    try {
      const entry = this.historyRepository.create({
        userId,
        originLat: dto.originLat,
        originLon: dto.originLon,
        destinationLat: dto.destinationLat,
        destinationLon: dto.destinationLon,
        originLabel: dto.originLabel ?? null,
        destinationLabel: dto.destinationLabel ?? null,
      });
      await this.historyRepository.save(entry);
    } catch (error) {
      this.logger.error(
        "Echec de l'enregistrement d'une entree d'historique de trajet",
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Renvoie les trajets recents distincts de l'utilisateur (issue #11),
   * les plus recents d'abord, plafonnes a MAX_RECENT_ENTRIES.
   *
   * Charge toutes les entrees dans la fenetre de retention (12 mois,
   * TRIP_HISTORY_RETENTION_DAYS) triees par date decroissante, puis
   * deduplique en memoire par couple origine/destination arrondi a 4
   * decimales (~11 metres, evite que deux recherches quasi identiques a
   * quelques metres pres comptent comme deux trajets distincts) - cette
   * deduplication ne peut pas se faire en SQL car les coordonnees sont
   * chiffrees avec un IV aleatoire a chaque ecriture (voir
   * TripHistoryEntry), donc jamais comparables par un WHERE.
   */
  async findRecent(userId: string): Promise<TripHistoryEntryDto[]> {
    const since = this.retentionCutoff();
    const entries = await this.historyRepository.find({
      where: { userId },
      order: { searchedAt: 'DESC' },
    });

    const seen = new Set<string>();
    const recent: TripHistoryEntryDto[] = [];
    for (const entry of entries) {
      if (entry.searchedAt < since) {
        // Les entrees sont deja triees par date decroissante : des qu'on
        // depasse la fenetre de retention, tout le reste l'est aussi.
        break;
      }
      const key = this.routeKey(entry);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      recent.push({
        id: entry.id,
        originLat: entry.originLat,
        originLon: entry.originLon,
        originLabel: entry.originLabel ?? undefined,
        destinationLat: entry.destinationLat,
        destinationLon: entry.destinationLon,
        destinationLabel: entry.destinationLabel ?? undefined,
        lastSearchedAt: entry.searchedAt.toISOString(),
      });
      if (recent.length >= MAX_RECENT_ENTRIES) {
        break;
      }
    }
    return recent;
  }

  /**
   * Supprime les entrees depassant la fenetre de retention (12 mois
   * glissants, docs/specs/rgpd-geolocalisation.md section 3.1). Appelee
   * quotidiennement par handleDailyPurge, exposee separement pour etre
   * testable sans dependre du scheduler.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.historyRepository.delete({
      searchedAt: LessThan(this.retentionCutoff()),
    });
    return result.affected ?? 0;
  }

  /**
   * Purge quotidienne automatique (spec RGPD section 3.1 : "job planifie
   * plutot qu'une purge manuelle", pour ne jamais dependre d'une
   * intervention humaine reguliere). Necessite ScheduleModule.forRoot()
   * enregistre globalement (voir AppModule).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyPurge(): Promise<void> {
    const deleted = await this.purgeExpired();
    if (deleted > 0) {
      this.logger.log(
        `Purge RGPD de l'historique des trajets : ${deleted} entree(s) au-dela de ${TRIP_HISTORY_RETENTION_DAYS} jours supprimee(s)`,
      );
    }
  }

  private retentionCutoff(): Date {
    return new Date(
      Date.now() - TRIP_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
  }

  /** Cle de deduplication : couple origine/destination arrondi (voir findRecent). */
  private routeKey(entry: TripHistoryEntry): string {
    const round = (value: number) => value.toFixed(4);
    return [
      round(entry.originLat),
      round(entry.originLon),
      round(entry.destinationLat),
      round(entry.destinationLon),
    ].join('|');
  }
}
