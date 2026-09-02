import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';
import { GbfsClientService } from './gbfs-client.service';

/**
 * Flux GBFS reel de la metropole (velos en libre-service "le velo STAR",
 * standard GBFS station-based - verifie en session,
 * https://eu.ftp.opendatasoft.com/star/gbfs/gbfs.json, ttl publie de 60s
 * pour station_status). Meme raisonnement de valeur par defaut codee en dur
 * que DEFAULT_GTFS_SOURCE_URL (gtfs-import.service.ts) : un flux reel plutot
 * qu'un exemple, surchargeable via GBFS_DISCOVERY_URL pour pointer un autre
 * operateur (voir .env.example).
 */
const DEFAULT_GBFS_DISCOVERY_URL =
  'https://eu.ftp.opendatasoft.com/star/gbfs/gbfs.json';

/**
 * Cache memoire des stations/vehicules GBFS (issue #13), rafraichi
 * periodiquement plutot qu'interroge a chaque requete de GET
 * /shared-mobility-stations : les compteurs de disponibilite ont un TTL
 * cote operateur de l'ordre de la minute (voir DEFAULT_GBFS_DISCOVERY_URL),
 * interroger le flux a chaque appel API n'apporterait aucune fraicheur
 * supplementaire pour un cout reseau nettement plus eleve (eco-conception,
 * CLAUDE.md) - surtout que ce endpoint est destine a etre appele en continu
 * par la carte cote frontend (MapView).
 *
 * Cache en memoire (pas en base) : donnee volatile par nature, aucune valeur
 * a la persister au-dela du prochain rafraichissement - voir GtfsStop pour
 * le contre-exemple (arrets, quasi-statiques, eux bien geolocalises en
 * base PostGIS).
 */
@Injectable()
export class GbfsCacheService implements OnModuleInit {
  private readonly logger = new Logger(GbfsCacheService.name);
  private stations: SharedMobilityStation[] = [];

  constructor(
    private readonly gbfsClient: GbfsClientService,
    private readonly configService: ConfigService,
  ) {}

  /** Premier chargement au demarrage - la carte doit pouvoir afficher des stations des la premiere requete, sans attendre jusqu'a une minute le premier @Cron. */
  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  /**
   * Rafraichissement periodique (toutes les minutes, alignement approximatif
   * sur le ttl du flux STAR). GbfsClientService degrade deja en interne
   * (tableau vide logge, jamais d'exception a rattraper ici) - mais un
   * tableau vide en sortie du connecteur est ambigu (reseau operateur
   * reellement vide, ou panne temporaire du flux ?). Un reseau de
   * libre-service d'une metropole n'est en pratique jamais reellement a
   * zero station : un resultat vide alors que le cache contenait deja des
   * stations est donc traite comme une panne transitoire et ignore (on
   * conserve les dernieres donnees connues, mode degrade plutot que carte
   * subitement videe) - seul un resultat non vide, ou le tout premier
   * chargement, remplace le cache.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refresh(): Promise<void> {
    const discoveryUrl = this.configService.get<string>(
      'GBFS_DISCOVERY_URL',
      DEFAULT_GBFS_DISCOVERY_URL,
    );
    const fetched = await this.gbfsClient.fetchStations(discoveryUrl);

    if (fetched.length === 0 && this.stations.length > 0) {
      this.logger.warn(
        'Rafraichissement GBFS vide alors que le cache contenait des stations - conservation des dernieres donnees connues (panne transitoire supposee)',
      );
      return;
    }

    this.stations = fetched;
    this.logger.log(
      `Cache GBFS rafraichi : ${this.stations.length} station(s)/vehicule(s)`,
    );
  }

  /** Etat courant du cache, servi tel quel par GbfsController - jamais de I/O ici. */
  getStations(): SharedMobilityStation[] {
    return this.stations;
  }
}
