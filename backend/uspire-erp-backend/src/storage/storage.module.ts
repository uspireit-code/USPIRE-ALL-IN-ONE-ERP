import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider';
import { STORAGE_PROVIDER } from './storage.provider';

@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
