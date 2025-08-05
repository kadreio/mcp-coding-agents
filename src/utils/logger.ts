/**
 * Simple logger that suppresses output in STDIO mode
 */

// Check if we're in STDIO mode
const isStdio = process.argv.includes('stdio') || 
                (process.argv.includes('--transport') && 
                 process.argv.indexOf('--transport') + 1 < process.argv.length &&
                 process.argv[process.argv.indexOf('--transport') + 1] === 'stdio');

export const logger = {
  log(...args: any[]): void {
    if (!isStdio) {
      console.log(...args);
    }
  },
  
  error(...args: any[]): void {
    if (!isStdio) {
      console.error(...args);
    }
  },
  
  warn(...args: any[]): void {
    if (!isStdio) {
      console.warn(...args);
    }
  }
};

// Export individual functions for convenience
export const log = logger.log;
export const error = logger.error;
export const warn = logger.warn;