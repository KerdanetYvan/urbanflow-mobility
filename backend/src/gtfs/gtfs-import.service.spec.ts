import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import { GtfsImportService } from './gtfs-import.service';
import { GtfsValidationError } from './gtfs-parser';

// Auto-mock : les exports de fs/promises sont en lecture seule (interop
// ESM), jest.spyOn ne peut pas les redefinir directement - jest.mock les
// remplace toutes par des jest.fn() des le chargement du module.
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

/** Meme helper que gtfs-parser.spec.ts : un zip GTFS minimal mais valide. */
function buildValidGtfsZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    'stops.txt',
    Buffer.from(
      'stop_id,stop_name,stop_lat,stop_lon\nA,Place Test,48.11,-1.68\nB,Gare Test,48.12,-1.67\n',
    ),
  );
  zip.addFile(
    'routes.txt',
    Buffer.from(
      'route_id,route_short_name,route_long_name,route_type\nT1,T1,Ligne Test,3\n',
    ),
  );
  zip.addFile(
    'trips.txt',
    Buffer.from('route_id,service_id,trip_id\nT1,everyday,T1_0800\n'),
  );
  zip.addFile(
    'calendar.txt',
    Buffer.from(
      'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\neveryday,1,1,1,1,1,1,1,20260101,20271231\n',
    ),
  );
  return zip.toBuffer();
}

function buildInvalidGtfsZip(): Buffer {
  // calendar.txt manquant : flux structurellement incomplet.
  const zip = new AdmZip();
  zip.addFile(
    'stops.txt',
    Buffer.from(
      'stop_id,stop_name,stop_lat,stop_lon\nA,Place Test,48.11,-1.68\n',
    ),
  );
  zip.addFile(
    'routes.txt',
    Buffer.from('route_id,route_short_name,route_type\nT1,T1,3\n'),
  );
  zip.addFile(
    'trips.txt',
    Buffer.from('route_id,service_id,trip_id\nT1,everyday,T1_0800\n'),
  );
  return zip.toBuffer();
}

function createRepositoryMock() {
  return {
    upsert: jest.fn().mockResolvedValue(undefined),
  };
}

function jsonArrayBufferResponse(
  buffer: Buffer,
  ok = true,
  status = 200,
): Response {
  return {
    ok,
    status,
    arrayBuffer: () =>
      Promise.resolve(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
      ),
  } as Response;
}

describe('GtfsImportService', () => {
  let service: GtfsImportService;
  let repository: ReturnType<typeof createRepositoryMock>;
  let configService: { get: jest.Mock };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    // jest.mock('fs/promises') cree les mocks une seule fois au chargement
    // du module : sans ce clear, l'historique d'appels d'un test precedent
    // fausserait les assertions "not.toHaveBeenCalled()" de celui-ci.
    jest.clearAllMocks();
    repository = createRepositoryMock();
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'GTFS_LOCAL_PATH') return '';
        return defaultValue;
      }),
    };
    service = new GtfsImportService(
      repository as never,
      configService as never,
    );

    fetchSpy = jest.spyOn(global, 'fetch');
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.mkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('telecharge le flux source, upsert les arrets et ecrit le zip pour OTP', async () => {
    const zipBuffer = buildValidGtfsZip();
    fetchSpy.mockResolvedValue(jsonArrayBufferResponse(zipBuffer));

    const summary = await service.run();

    expect(repository.upsert).toHaveBeenCalledTimes(1);
    const [rows, conflictKeys] = repository.upsert.mock.calls[0] as [
      { gtfsId: string; name: string; location: unknown }[],
      string[],
    ];
    expect(rows).toEqual([
      {
        gtfsId: 'A',
        name: 'Place Test',
        location: { type: 'Point', coordinates: [-1.68, 48.11] },
      },
      {
        gtfsId: 'B',
        name: 'Gare Test',
        location: { type: 'Point', coordinates: [-1.67, 48.12] },
      },
    ]);
    expect(conflictKeys).toEqual(['gtfsId']);

    expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
    const [, writtenBuffer] = mockedFs.writeFile.mock.calls[0];
    expect(Buffer.from(writtenBuffer as Buffer)).toEqual(zipBuffer);

    expect(summary).toEqual({
      stopsUpserted: 2,
      routesValidated: 1,
      tripsValidated: 1,
      calendarValidated: 1,
    });
  });

  it('lit un flux local si GTFS_LOCAL_PATH est renseigne, sans telecharger', async () => {
    const zipBuffer = buildValidGtfsZip();
    configService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'GTFS_LOCAL_PATH') return '/local/gtfs-test.zip';
        return defaultValue;
      },
    );
    mockedFs.readFile.mockResolvedValue(zipBuffer);

    await service.run();

    expect(mockedFs.readFile).toHaveBeenCalledWith('/local/gtfs-test.zip');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ne modifie ni la base ni le disque si le flux GTFS est invalide', async () => {
    fetchSpy.mockResolvedValue(jsonArrayBufferResponse(buildInvalidGtfsZip()));

    await expect(service.run()).rejects.toThrow(GtfsValidationError);

    expect(repository.upsert).not.toHaveBeenCalled();
    expect(mockedFs.writeFile).not.toHaveBeenCalled();
  });
});
