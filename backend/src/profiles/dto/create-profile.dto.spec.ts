import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProfileDto } from './create-profile.dto';
import { TransportMode } from '../transport-mode.enum';

/**
 * Verifie la validation de `preferredTransportModes` de CreateProfileDto
 * (partagee avec UpdateProfileDto via PartialType) apres l'issue #278 :
 * seul le sous-ensemble PROFILE_TRANSPORT_MODES est accepte, trottinette et
 * covoiturage sont desormais rejetes cote API meme si l'enum TransportMode
 * les connait encore (recherche d'itineraire, suivi de trajet).
 *
 * Meme approche que push-endpoint.validator.spec.ts : on exerce le DTO reel
 * via class-validator plutot qu'un test e2e (aucun e2e profil dans ce
 * projet).
 */
async function validationErrorsFor(
  preferredTransportModes: string[],
): Promise<string[]> {
  // plainToInstance : reproduit ce que fait le ValidationPipe de NestJS a
  // partir du JSON de la requete (le body arrive en objet nu, pas en
  // instance de classe).
  const dto = plainToInstance(CreateProfileDto, {
    preferredTransportModes,
    accessibilityPreferences: [],
  });
  const errors = await validate(dto);
  // On ne renvoie que les proprietes en echec : suffisant pour cibler
  // l'assertion sur `preferredTransportModes` sans dependre du wording exact
  // des messages de class-validator.
  return errors.map((error) => error.property);
}

describe('CreateProfileDto - preferredTransportModes (issue #278)', () => {
  it('accepte les modes du sous-ensemble profil (marche, velo, transports en commun)', async () => {
    const errors = await validationErrorsFor([
      TransportMode.WALKING,
      TransportMode.CYCLING,
      TransportMode.BUS,
      TransportMode.TRAM,
      TransportMode.METRO,
      TransportMode.TRAIN_TER,
    ]);

    expect(errors).not.toContain('preferredTransportModes');
  });

  it('accepte un tableau vide (aucune preference cochee)', async () => {
    const errors = await validationErrorsFor([]);

    expect(errors).not.toContain('preferredTransportModes');
  });

  it('rejette la trottinette (retiree du selecteur de profil)', async () => {
    const errors = await validationErrorsFor([
      TransportMode.WALKING,
      TransportMode.SCOOTER,
    ]);

    expect(errors).toContain('preferredTransportModes');
  });

  it('rejette le covoiturage (retire du selecteur de profil)', async () => {
    const errors = await validationErrorsFor([TransportMode.CARPOOLING]);

    expect(errors).toContain('preferredTransportModes');
  });

  it('rejette toujours une valeur totalement inconnue', async () => {
    const errors = await validationErrorsFor(['helicopter']);

    expect(errors).toContain('preferredTransportModes');
  });
});
