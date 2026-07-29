import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TransportMode } from '../profiles/transport-mode.enum';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';

/**
 * Jeu de donnees minimal pour developper/demontrer en local sans dependre
 * des vraies donnees de la metropole (issue #40). Deux comptes calques sur
 * les personas du dossier de certification (partie 2.3) pour rester
 * coherent avec les scenarios deja documentes, plus un compte sans profil
 * pour tester cet etat specifique (voir ProfilPage.tsx cote frontend, qui
 * traite un 404 sur GET /profiles/me comme "pas encore de profil").
 *
 * Mots de passe en clair ici volontairement : ce sont des identifiants de
 * developpement local documentes dans backend/README.md, pas des secrets -
 * le hash reste calcule normalement par UsersService.create() (bcryptjs,
 * memes 10 rounds que l'inscription reelle).
 */
interface SeedUser {
  email: string;
  password: string;
  profile: {
    preferredTransportModes: TransportMode[];
    reducedMobility: boolean;
    maxWalkingDistanceMeters?: number;
    maxTransfers?: number;
  } | null;
}

const SEED_USERS: SeedUser[] = [
  {
    // Antoine : jeune actif en alternance, sans moyen de transport
    // personnel, veut un trajet lisible sans reglage prealable - profil de
    // preferences large, aucune contrainte d'accessibilite.
    email: 'antoine@urbanflow.test',
    password: 'Antoine123!',
    profile: {
      preferredTransportModes: [
        TransportMode.WALKING,
        TransportMode.PUBLIC_TRANSPORT,
        TransportMode.SCOOTER,
      ],
      reducedMobility: false,
    },
  },
  {
    // Muriel : sensible aux obstacles d'accessibilite (trottoirs
    // degrades, absence de banc) et evite les correspondances - profil de
    // mobilite reduite avec un nombre de correspondances maximum a 0.
    email: 'muriel@urbanflow.test',
    password: 'Muriel123!',
    profile: {
      preferredTransportModes: [
        TransportMode.PUBLIC_TRANSPORT,
        TransportMode.WALKING,
      ],
      reducedMobility: true,
      maxWalkingDistanceMeters: 500,
      maxTransfers: 0,
    },
  },
  {
    // Compte volontairement sans profil : permet de tester/demontrer
    // l'etat "pas encore de profil" (formulaire vide sur ProfilPage,
    // POST plutot que PATCH a la premiere sauvegarde) sans avoir a
    // supprimer le profil d'un des deux comptes ci-dessus.
    email: 'sans-profil@urbanflow.test',
    password: 'SansProfil123!',
    profile: null,
  },
];

/**
 * Cree un compte (ou reutilise celui deja present) puis son profil de
 * mobilite eventuel, en passant par les services applicatifs plutot que
 * des insertions SQL directes - meme hashage de mot de passe, memes
 * validations, memes contraintes qu'un vrai appel a l'API.
 */
async function seedUser(
  usersService: UsersService,
  profilesService: ProfilesService,
  seed: SeedUser,
): Promise<void> {
  let userId: string;

  try {
    const user = await usersService.create({
      email: seed.email,
      password: seed.password,
    });
    userId = user.id;
    console.log(`✓ Utilisateur créé : ${seed.email}`);
  } catch (error) {
    if (!(error instanceof ConflictException)) {
      throw error;
    }
    // Deja seede lors d'un lancement precedent : script idempotent, on
    // recupere juste l'id existant pour pouvoir quand meme traiter le
    // profil ci-dessous.
    const existing = await usersService.findByEmail(seed.email);
    if (!existing) {
      throw error;
    }
    userId = existing.id;
    console.log(`… Utilisateur déjà présent : ${seed.email}`);
  }

  if (!seed.profile) {
    return;
  }

  try {
    await profilesService.create(userId, seed.profile);
    console.log(`  ✓ Profil de mobilité créé pour ${seed.email}`);
  } catch (error) {
    if (!(error instanceof ConflictException)) {
      throw error;
    }
    console.log(`  … Profil déjà présent pour ${seed.email}`);
  }
}

async function main() {
  // createApplicationContext plutot que create() : on a besoin du
  // container de dependances (services, connexion TypeORM) mais pas du
  // serveur HTTP - plus rapide a demarrer/arreter pour un script one-shot.
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const profilesService = app.get(ProfilesService);

  console.log('Seed de la base de données…\n');

  for (const seed of SEED_USERS) {
    await seedUser(usersService, profilesService, seed);
  }

  console.log('\nComptes de test disponibles (voir backend/README.md) :');
  for (const seed of SEED_USERS) {
    console.log(`  ${seed.email} / ${seed.password}`);
  }

  await app.close();
}

main().catch((error) => {
  console.error('Échec du seed :', error);
  process.exitCode = 1;
});
