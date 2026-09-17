import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../../application/ports/id-generator.js';

@Injectable()
export class CryptoIdGenerator extends IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
