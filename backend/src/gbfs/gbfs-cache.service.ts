import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OperatorsService } from '../operators/operators.service';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';
import { GbfsClientService } from './gbfs-client.service';

/**
 * Cache memoire des stations/vehicules GBFS de TOUS les operateurs
 * configures (issue #13, generalise multi-operateur par issue #15) - un
 * seul appel HTTP par operateur publiant du GBFS (OperatorsService, filtre
 * sur gbfsDiscoveryUrl present), resultats fusionnes en un seul tableau -
 * rafraichi periodiquement plutot qu'interroge a chaque requete de GET
 * /shared-mobility-stations : les compteurs de disponibilite ont un TTL
 * cote operateur de l'ordre de la minute, interroger le flux a chaque appel
 * API n'apporterait aucune fraicheur supplementaire pour un cout reseau
 * nettement plus eleve (eco-conception, CLAUDE.md) - surtout que ce
 * endpoint est destine a etre appele en continu par la carte cote frontend
 * (MapView).
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
    private readonly operatorsService: OperatorsService,
  ) {}

  /** Premier chargement au demarrage - la carte doit pouvoir afficher des stations des la premiere requete, sans attendre jusqu'a une minute le premier @Cron. */
  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  /**
   * Rafraichissement periodique (toutes les minutes, alignement approximatif
   * sur le ttl du flux STAR). Interroge en parallele chaque operateur
   * publiant du GBFS (issue #15) - GbfsClientService degrade deja en
   * interne par operateur (tableau vide logge, jamais d'exception a
   * rattraper ici), un operateur en panne ne prive donc pas les autres de
   * leur mise a jour.
   *
   * Un tableau vide en sortie (tous operateurs confondus) est ambigu (reseau
   * reellement vide, ou panne transitoire generalisee ?). Un reseau de
   * libre-service d'une metropole n'est en pratique jamais reellement a
   * zero station : un resultat vide alors que le cache contenait deja des
   * stations est donc traite comme une panne transitoire et ignore (on
   * conserve les dernieres donnees connues, mode degrade plutot que carte
   * subitement videe) - seul un resultat non vide, ou le tout premier
   * chargement, remplace le cache.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refresh(): Promise<void> {
    const operators = this.operatorsService
      .getOperators()
      .filter((operator) => operator.gbfsDiscoveryUrl);

    const perOperator = await Promise.all(
      operators.map((operator) =>
        this.gbfsClient.fetchStations(
          operator.gbfsDiscoveryUrl as string,
          operator.id,
        ),
      ),
    );
    const fetched = perOperator.flat();

    if (fetched.length === 0 && this.stations.length > 0) {
      this.logger.warn(
        'Rafraichissement GBFS vide alors que le cache contenait des stations - conservation des dernieres donnees connues (panne transitoire supposee)',
      );
      return;
    }

    this.stations = fetched;
    this.logger.log(
      `Cache GBFS rafraichi : ${this.stations.length} station(s)/vehicule(s) sur ${operators.length} operateur(s)`,
    );
  }

  /** Etat courant du cache, servi tel quel par GbfsController - jamais de I/O ici. */
  getStations(): SharedMobilityStation[] {
    return this.stations;
  }
}
