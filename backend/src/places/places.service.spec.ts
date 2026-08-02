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
      { lat: 48.119, lng: -1.674, description: 'Gare Test', id: '1:B' },
      { lat: 48.111, lng: -1.682, description: 'Place Centrale', id: '1:A' },
    ]);

    const result = await service.search({ query: 'a' });

    expect(result).toEqual([
      { label: 'Gare Test', lat: 48.119, lon: -1.674 },
      { label: 'Place Centrale', lat: 48.111, lon: -1.682 },
    ]);
  });

  it('renvoie un tableau vide quand aucun lieu ne correspond (pas une erreur)', async () => {
    otpClient.geocode.mockResolvedValue([]);

    const result = await service.search({ query: 'xyzzynotfound' });

    expect(result).toEqual([]);
  });
});
