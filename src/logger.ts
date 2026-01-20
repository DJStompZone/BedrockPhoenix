import pino from "pino";
import { Config } from "./config/types";

export type Logger = pino.Logger;

export function createLogger(config: Config): Logger {
  return pino({
    level: config.observability.logLevel,
    transport: config.observability.logHuman
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  });
}
