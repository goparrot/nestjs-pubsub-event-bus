import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import type { ICqrsModuleOptions } from './ICqrsModuleOptions';

export interface ICqrsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useFactory: FactoryProvider<Promise<ICqrsModuleOptions> | ICqrsModuleOptions>['useFactory'];
    inject: FactoryProvider['inject'];

    /**
     * If "true", registers `CqrsModule` as a global module.
     * See: https://docs.nestjs.com/modules#global-modules
     */
    isGlobal?: boolean;
}
