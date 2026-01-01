import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ReadinessService } from './readiness.service';

@Controller()
export class ReadyController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get('ready')
  async ready() {
    const db = await this.readiness.checkDb();
    const storage = await this.readiness.checkStorage();

    const ok = db === 'ok' && storage === 'ok';

    if (!ok) {
      throw new HttpException(
        {
          status: 'fail',
          checks: { db, storage },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ok', checks: { db, storage } };
  }
}
