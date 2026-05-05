export interface Logger {
  info: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
}

export const defaultLogger: Required<Logger> = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  debug: () => {},
};
