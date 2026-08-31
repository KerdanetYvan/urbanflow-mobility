import { ServiceUnavailableException } from '@nestjs/common';
import { PlacesService } from './places.service';

describe('PlacesService', () => {
  let service: PlacesService;
  let otpClient: { geocode: jest.Mock };
  let nominatimClient: { search: jest.Mock };

  beforeEach(() => {
    otpClient = { geocode: jest.fn().mockResolvedValue([]) };
    nominatimClient = { search: jest.fn().mockResolvedValue([]) };
    service = new PlacesService(otpClient as never, nominatimClient as never);
  });

  it('interroge les deux sources avec le texte de recherche', async () => {
    await service.search({ query: 'Gare' });

    expect(otpClient.geocode).toHaveBeenCalledWith('Gare');
    expect(nominatimClient.search).toHaveBeenCalledWith('Gare');
  });

  it('reformate les arrets OTP (lng -> lon, description -> label, kind stop)', async () => {
    otpClient.geocode.mockResolvedValue([
      { lat: 48.119, lng: -1.674, description: 'Gare Test', id: '1:B' },
    ]);

    const result = await service.search({ query: 'a' });

    expect(result).toEqual([
      { label: 'Gare Test', lat: 48.119, lon: -1.674, kind: 'stop' },
    ]);
  });

  it("retire le code entre parentheses et deduplique les poteaux d'un meme arret (issue #168)", async () => {
    otpClient.geocode.mockResolvedValue([
      { lat: 48.109, lng: -1.678, description: 'République (1615)', id: '1:a' },
      { lat: 48.109, lng: -1.679, description: 'République (1242)', id: '1:b' },
      { lat: 48.109, lng: -1.68, description: 'République (1214)', id: '1:c' },
    ]);

    const result = await service.search({ query: 'Repu' });

    // Une seule entree "République", celle du premier resultat OTP.
    expect(result).toEqual([
      { label: 'République', lat: 48.109, lon: -1.678, kind: 'stop' },
    ]);
  });

  it('fusionne : arrets en premier, puis adresses (kind address)', async () => {
    otpClient.geocode.mockResolvedValue([
      { lat: 48.11, lng: -1.68, description: 'Gares (5070)', id: '1:x' },
    ]);
    nominatimClient.search.mockResolvedValue([
      { label: '12 Rue de Nemours, Rennes', lat: 48.108, lon: -1.677 },
    ]);

    const result = await service.search({ query: 'Nemours' });

    expect(result).toEqual([
      { label: 'Gares', lat: 48.11, lon: -1.68, kind: 'stop' },
      {
        label: '12 Rue de Nemours, Rennes',
        lat: 48.108,
        lon: -1.677,
        kind: 'address',
      },
    ]);
  });

  it('plafonne a 5 arrets + 5 adresses', async () => {
    otpClient.geocode.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        lat: 48 + i / 1000,
        lng: -1.6,
        description: `Arret ${i}`,
        id: `1:${i}`,
      })),
    );
    nominatimClient.search.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        label: `Adresse ${i}`,
        lat: 48 + i / 1000,
        lon: -1.7,
      })),
    );

    const result = await service.search({ query: 'x' });

    expect(result.filter((p) => p.kind === 'stop')).toHaveLength(5);
    expect(result.filter((p) => p.kind === 'address')).toHaveLength(5);
  });

  it('renvoie les arrets seuls quand Nominatim rejette (degradation, spec §5)', async () => {
    otpClient.geocode.mockResolvedValue([
      { lat: 48.11, lng: -1.68, description: 'Gares (5070)', id: '1:x' },
    ]);
    nominatimClient.search.mockRejectedValue(new Error('down'));

    const result = await service.search({ query: 'Gares' });

    expect(result).toEqual([
      { label: 'Gares', lat: 48.11, lon: -1.68, kind: 'stop' },
    ]);
  });

  it('renvoie les adresses seules quand OTP rejette (assouplit le 503 historique, spec §5)', async () => {
    otpClient.geocode.mockRejectedValue(new ServiceUnavailableException('otp'));
    nominatimClient.search.mockResolvedValue([
      { label: '5 Boulevard de la Liberté, Rennes', lat: 48.11, lon: -1.68 },
    ]);

    const result = await service.search({ query: 'Liberté' });

    expect(result).toEqual([
      {
        label: '5 Boulevard de la Liberté, Rennes',
        lat: 48.11,
        lon: -1.68,
        kind: 'address',
      },
    ]);
  });

  it('propage un 503 uniquement quand les DEUX sources rejettent', async () => {
    otpClient.geocode.mockRejectedValue(new ServiceUnavailableException('otp'));
    nominatimClient.search.mockRejectedValue(new Error('nominatim down'));

    await expect(service.search({ query: 'x' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('renvoie un tableau vide quand aucune source ne trouve rien (pas une erreur)', async () => {
    const result = await service.search({ query: 'xyzzynotfound' });

    expect(result).toEqual([]);
  });
});
