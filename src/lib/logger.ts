/**
 * Conditional logger utility for development vs production
 * Prevents console spam in production while keeping debug info in development
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log info messages - only in development
   */
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * Log debug messages - only in development
   */
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },

  /**
   * Log warnings - only in development
   */
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },

  /**
   * Log errors - always logged (even in production)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Log info messages - always logged
   */
  info: (...args: unknown[]) => {
    console.info(...args);
  },
};
