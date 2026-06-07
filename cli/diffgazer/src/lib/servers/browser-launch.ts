import { getErrorMessage } from "@diffgazer/core/errors";
import open from "open";

type BrowserOpener = (address: string) => Promise<unknown>;

export function openBrowserAddress(address: string, opener: BrowserOpener = open): void {
  void Promise.resolve()
    .then(() => opener(address))
    .catch((err: unknown) => {
      console.warn(`Could not open browser at ${address}: ${getErrorMessage(err)}`);
    });
}

export function createReadyHandler(openBrowser = true): (address: string) => void {
  return (address) => {
    console.log(`Diffgazer is running at ${address}`);
    if (openBrowser) {
      openBrowserAddress(address);
    }
  };
}
