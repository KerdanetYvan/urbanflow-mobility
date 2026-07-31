import { PlacesService } from './places.service';

describe('PlacesService', () => {
  let service: PlacesService;
  let otpClient: { geocode: jest.Mock };

  beforeEach(() => {
    otpClient = { geocode: jest.fn() };
    service = new PlacesService(otpClient as never);
  });

  it('transmet le texte de recherche a OtpClientService', async () => {
    otpClient.geocode.mockResolvedValue([]);

    await service.search({ query: 'Gare' });

    expect(otpClient.geocode).toHaveBeenCalledWith('Gare');
  });

  it('reformate les resultats OTP (lng -> lon, description -> label)', async () => {
    otpClient.geocode.mockResolvedValue([
      { lat: 45.762, lng: 4.848, description: 'Gare Test', id: '1:B' },
      { lat: 45.754, lng: 4.84, description: 'Place Centrale', id: '1:A' },
    ]);

    const result = await service.search({ query: 'a' });

    expect(result).toEqual([
      { label: 'Gare Test', lat: 45.762, lon: 4.848 },
      { label: 'Place Centrale', lat: 45.754, lon: 4.84 },
    ]);
  });

  it('renvoie un tableau vide quand aucun lieu ne correspond (pas une erreur)', async () => {
    otpClient.geocode.mockResolvedValue([]);

    const result = await service.search({ query: 'xyzzynotfound' });

    expect(result).toEqual([]);
  });
});
