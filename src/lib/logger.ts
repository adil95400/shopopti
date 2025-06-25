const isDev = import.meta.env.DEV;
export const logger = {
  info: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
};
export default logger;
