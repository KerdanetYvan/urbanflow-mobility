import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

// Charge .env pour un usage CLI hors conteneur (host, script seed) ; sans
// effet en conteneur ou les variables sont deja injectees par env_file.
config();

/**
 * DataSource utilise uniquement par la CLI TypeORM (migration:generate,
 * migration:run, migration:revert). Independant du bootstrap Nest (voir
 * app.module.ts pour la configuration runtime de l'application), car
 * TypeOrmModule.forRootAsync() ne peut pas etre reutilise directement par
 * la CLI qui a besoin d'un DataSourceOptions synchrone.
 *
 * Les globs entities/migrations fonctionnent aussi bien en dev (ts-node,
 * __dirname = src/) qu'une fois compile en production (__dirname = dist/).
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
