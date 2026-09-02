import { Module } from '@nestjs/common';
import { OperatorsService } from './operators.service';

/**
 * Registre des operateurs de mobilite pluggables (issue #15) - consomme par
 * GbfsModule (#13) et GtfsRealtimeModule (#14), voir OperatorsService.
 */
@Module({
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
