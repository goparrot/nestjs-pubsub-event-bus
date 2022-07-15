import type { ICqrsModuleOptions } from './ICqrsModuleOptions';

export interface ICqrsModuleSyncOptions extends ICqrsModuleOptions {
    /**
     * If "true", registers `CqrsModule` as a global module.
     * See: https://docs.nestjs.com/modules#global-modules
     */
    isGlobal?: boolean;
}
