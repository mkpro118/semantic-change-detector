/* eslint-disable no-console */ // only file allowed to use console

/**
 * Defines the verbosity levels for logging.
 */
export enum LogLevel {
  /** No output except for fatal errors. */
  QUIET = 0,
  /** Machine-readable output, typically JSON, for scripting. */
  MACHINE = 1,
  /** Standard human-readable output for normal operation. */
  VERBOSE = 2,
  /** Maximum output for developers debugging the tool itself. */
  DEBUG = 3,
}

/**
 * A simple logger class to handle different levels of verbosity.
 * It allows setting a log level and provides methods to log messages
 * that will only be displayed if the current level is high enough.
 */
class Logger {
  /** The current logging level. Messages below this level will be suppressed. */
  private level: LogLevel = LogLevel.VERBOSE;

  /**
   * Sets the current logging level.
   * @param level The new logging level to set.
   */
  setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * Logs a message intended for machine consumption.
   * This output is typically used for scripting and is suppressed in QUIET mode.
   * @param message The machine-readable message to log.
   */
  machine(message: string) {
    if (this.level >= LogLevel.MACHINE) {
      console.log(message);
    }
  }

  /**
   * Logs a message for standard, human-readable output.
   * This is the default level of logging for user feedback.
   * @param message The verbose message to log.
   */
  verbose(message: string) {
    if (this.level >= LogLevel.VERBOSE) {
      console.log(message);
    }
  }

  /**
   * Logs a debug message for developers of this tool.
   * These messages are intended to help diagnose issues and are written to stderr.
   * @param message The debug message to log.
   */
  debug(message: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.error(`[DEBUG] ${message}`); // Debug messages go to stderr
    }
  }
}

/**
 * The singleton instance of the Logger used throughout the application.
 */
export const logger = new Logger();
