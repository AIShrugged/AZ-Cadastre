import { ConfigurableModuleBuilder } from '@nestjs/common';

export type LoggerModuleOptions = {
  /** Value of the `service` field on every line. */
  service: string;
  /** fatal | error | warn | info | debug | trace | silent. */
  level?: string;
  /**
   * Human-readable colourised output for a terminal; one JSON object per line
   * on stdout when false, which is what a log collector wants.
   */
  pretty?: boolean;
};

export const {
  ConfigurableModuleClass: LoggerConfigurableModule,
  MODULE_OPTIONS_TOKEN: LOGGER_OPTIONS,
} = new ConfigurableModuleBuilder<LoggerModuleOptions>()
  .setClassMethodName('forRoot')
  .setExtras({ isGlobal: true }, (definition, extras) => ({
    ...definition,
    global: extras.isGlobal,
  }))
  .build();
