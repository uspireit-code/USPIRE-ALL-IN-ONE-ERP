import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ArReceiptsService {
  async listReceipts() {
    return [];
  }

  async getReceiptById(_id: string) {
    throw new NotFoundException('Receipt not found');
  }
}
