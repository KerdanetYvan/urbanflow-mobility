import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MobilityProfile } from './mobility-profile.entity';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(MobilityProfile)
    private readonly profilesRepository: Repository<MobilityProfile>,
  ) {}

  /**
   * Cree le profil de l'utilisateur authentifie. `userId` vient toujours du
   * JWT (voir ProfilesController), jamais d'une valeur fournie par le
   * client dans le corps de la requete - un utilisateur ne peut creer que
   * SON PROPRE profil.
   */
  async create(
    userId: string,
    dto: CreateProfileDto,
  ): Promise<MobilityProfile> {
    const existing = await this.profilesRepository.findOneBy({ userId });
    if (existing) {
      throw new ConflictException('Un profil existe déjà pour cet utilisateur');
    }

    // Champs domicile/travail (issue #113) normalises explicitement a null
    // plutot que laisses `undefined` : une classe DTO declare TOUS ses champs
    // (meme optionnels) comme des champs de classe ES2022+ (target ES2023,
    // voir tsconfig.json), qui deviennent des proprietes propres valant
    // `undefined` des la construction de l'instance - meme absent du corps de
    // requete. `undefined` n'est pas une valeur stable a persister (voir
    // assertCompleteAddressPairs ci-dessous, qui distingue "absent" de
    // "invalide" via `!= null`), d'ou cette normalisation explicite - meme
    // motif que TripHistoryService#record (`dto.originLabel ?? null`).
    const profile = this.profilesRepository.create({
      userId,
      ...dto,
      homeLabel: dto.homeLabel ?? null,
      homeLat: dto.homeLat ?? null,
      homeLon: dto.homeLon ?? null,
      workLabel: dto.workLabel ?? null,
      workLat: dto.workLat ?? null,
      workLon: dto.workLon ?? null,
    });
    this.assertCompleteAddressPairs(profile);
    return this.profilesRepository.save(profile);
  }

  async findByUserId(userId: string): Promise<MobilityProfile> {
    const profile = await this.profilesRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Profil introuvable');
    }
    return profile;
  }

  /**
   * Variante de findByUserId qui renvoie null plutot que de lever
   * NotFoundException - un utilisateur authentifie qui n'a pas encore cree
   * de profil est un cas normal pour un appelant qui personnalise un
   * resultat plutot que d'exiger un profil (ex. TripsService#search, issue
   * #16 : classement pondere degrade sur les criteres de base sans profil,
   * jamais une erreur).
   */
  async findByUserIdOrNull(userId: string): Promise<MobilityProfile | null> {
    return this.profilesRepository.findOneBy({ userId });
  }

  async update(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<MobilityProfile> {
    const profile = await this.findByUserId(userId);
    // N'ecrase que les proprietes reellement fournies dans le corps de la
    // requete PATCH (voir omitUndefined ci-dessous) : une instance de DTO
    // porte TOUJOURS ses champs optionnels comme proprietes propres valant
    // `undefined` quand ils sont absents du corps (classes ES2022+, voir la
    // meme remarque dans create() ci-dessus) - un Object.assign naif les
    // ecraserait, effacant a tort une valeur deja enregistree (ex. PATCH ne
    // touchant que accessibilityPreferences viderait homeLat/homeLon s'ils
    // etaient deja definis).
    Object.assign(profile, this.omitUndefined(dto));
    this.assertCompleteAddressPairs(profile);
    return this.profilesRepository.save(profile);
  }

  async remove(userId: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    await this.profilesRepository.remove(profile);
  }

  /**
   * Ne garde que les proprietes propres dont la valeur n'est pas `undefined`
   * (voir update() ci-dessus pour le pourquoi). Ne traite pas `null`
   * specialement : ce projet n'a pas de semantique "effacer un champ via
   * null" a ce jour (voir CreateProfileDto, issue #113) - seul `undefined`
   * signifie "champ non fourni".
   */
  private omitUndefined<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
  }

  /**
   * Verifie qu'une adresse domicile/travail (issue #113) est soit complete
   * (latitude ET longitude), soit totalement absente - jamais une moitie
   * seule, inexploitable comme origine de recherche (issue #93). Appliquee
   * sur le profil APRES fusion (Object.assign dans update(), ou juste apres
   * repository.create() dans create()) plutot que sur le DTO brut recu : un
   * PATCH /profiles/me qui ne fournit que homeLon doit pouvoir completer un
   * homeLat deja enregistre lors d'un appel precedent, sans avoir a le
   * renvoyer.
   */
  private assertCompleteAddressPairs(profile: MobilityProfile): void {
    const pairs: Array<
      [label: string, lat: number | null, lon: number | null]
    > = [
      ['domicile', profile.homeLat, profile.homeLon],
      ['travail', profile.workLat, profile.workLon],
    ];
    for (const [label, lat, lon] of pairs) {
      const hasOne = lat != null || lon != null;
      const hasBoth = lat != null && lon != null;
      if (hasOne && !hasBoth) {
        throw new BadRequestException(
          `L'adresse ${label} nécessite latitude et longitude toutes les deux, ou aucune des deux`,
        );
      }
    }
  }
}
