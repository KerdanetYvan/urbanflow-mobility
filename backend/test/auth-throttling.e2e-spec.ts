import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Verifie le garde de limitation de debit (issue #21, audit OWASP - A04)
 * ajoute sur AuthController : au-dela de la limite configuree (10
 * requetes/minute/IP, voir AppModule), une reponse 429 doit etre renvoyee
 * plutot que de laisser l'endpoint d'authentification ouvert a un
 * bruteforce automatise.
 */
describe('AuthController - rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloque avec 429 au-dela de la limite sur /auth/login', async () => {
    const server = app.getHttpServer();
    const payload = { email: 'nobody@test.local', password: 'wrong' };

    // Les 10 premieres requetes sont autorisees par le garde (rejetees pour
    // identifiants invalides, 401 - ce n'est pas ce qui est teste ici) ;
    // seul le comportement du garde de debit importe.
    for (let i = 0; i < 10; i += 1) {
      await request(server).post('/auth/login').send(payload);
    }

    // La 11e requete dans la meme fenetre doit etre bloquee par le garde,
    // avant meme d'atteindre AuthService.
    const response = await request(server).post('/auth/login').send(payload);
    expect(response.status).toBe(429);
  });
});
