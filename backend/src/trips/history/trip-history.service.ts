import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createEncryptedColumnTransformer } from '../../common/encryption/encrypted-column.transformer';
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

    let entries: TripHistoryEntry[];
    try {
      // Chemin nominal : TypeORM applique le transformer de dechiffrement a
      // chaque ligne pendant l'hydratation.
      entries = await this.historyRepository.find({
        where: { userId },
        order: { searchedAt: 'DESC' },
      });
    } catch (error) {
      // Une SEULE ligne indechiffrable (cle rotee/perdue depuis l'ecriture,
      // ou octet corrompu en base) fait echouer tout le find() de TypeORM,
      // donc renvoyait jusqu'ici une 500 sur l'historique entier (issue
      // #281). Repli resilient : relecture brute puis dechiffrement ligne a
      // ligne, on ignore + logue celles qui echouent plutot que de rendre
      // tout l'historique inaccessible a cause d'une entree.
      this.logger.error(
        "Echec du chargement de l'historique via l'ORM (ligne indechiffrable ?) - repli sur une lecture resiliente ligne a ligne",
        error instanceof Error ? error.stack : error,
      );
      entries = await this.findRecentTolerant(userId);
    }

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
   * Repli de findRecent quand le chargement ORM echoue a cause d'une ligne
   * indechiffrable (issue #281). Relit les memes lignes en SQL brut (donc
   * SANS passer par le transformer de colonne, qui echouerait), puis
   * dechiffre chaque champ ligne a ligne : une ligne dont un champ ne se
   * dechiffre pas est ignoree et comptee, jamais propagee.
   *
   * @param userId identifiant de l'utilisateur dont on lit l'historique
   * @returns les entrees effectivement dechiffrables, triees par date
   *   decroissante (le tri et la deduplication restent faits par findRecent)
   */
  private async findRecentTolerant(
    userId: string,
  ): Promise<TripHistoryEntry[]> {
    // Colonnes nommees explicitement (voir TripHistoryEntry) : la lecture
    // brute court-circuite volontairement le transformer, on recupere donc
    // le texte chiffre tel quel dans chaque colonne coordonnee/libelle.
    const rows: Array<Record<string, unknown>> =
      await this.historyRepository.query(
        `SELECT id, user_id, origin_lat, origin_lon, destination_lat,
                destination_lon, origin_label, destination_label, searched_at
           FROM trip_history_entries
          WHERE user_id = $1
          ORDER BY searched_at DESC`,
        [userId],
      );

    // Deux instances suffisent (le transformer est sans etat) : une pour les
    // champs numeriques (coordonnees), une pour les champs texte (libelles).
    const numberCol = createEncryptedColumnTransformer<number>();
    const textCol = createEncryptedColumnTransformer<string>();

    const entries: TripHistoryEntry[] = [];
    let skipped = 0;
    for (const row of rows) {
      // Chaque colonne coordonnee/libelle est lue en texte chiffre brut ; on
      // la passe telle quelle a from(), qui accepte string | null | undefined.
      const cipher = (column: string): string | null =>
        (row[column] as string | null) ?? null;
      try {
        const entry = new TripHistoryEntry();
        entry.id = String(row.id);
        entry.userId = String(row.user_id);
        entry.originLat = numberCol.from(cipher('origin_lat')) as number;
        entry.originLon = numberCol.from(cipher('origin_lon')) as number;
        entry.destinationLat = numberCol.from(
          cipher('destination_lat'),
        ) as number;
        entry.destinationLon = numberCol.from(
          cipher('destination_lon'),
        ) as number;
        entry.originLabel =
          (textCol.from(cipher('origin_label')) as string | null) ?? null;
        entry.destinationLabel =
          (textCol.from(cipher('destination_label')) as string | null) ?? null;
        // `searched_at` n'est pas chiffree ; le driver pg peut la renvoyer en
        // Date ou en chaine selon le contexte - new Date() accepte les deux.
        entry.searchedAt = new Date(row.searched_at as string | Date);
        entries.push(entry);
      } catch {
        skipped += 1;
      }
    }

    if (skipped > 0) {
      this.logger.warn(
        `Historique de l'utilisateur ${userId} : ${skipped} entree(s) indechiffrable(s) ignoree(s) ` +
          "(cle de chiffrement rotee/perdue ou ligne corrompue) - le reste de l'historique est renvoye normalement",
      );
    }

    return entries;
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
