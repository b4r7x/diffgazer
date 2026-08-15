import { getErrorMessage } from "@diffgazer/core/errors";
import open from "open";
import { printToTerminal, warnToTerminal } from "../report-to-terminal";

type BrowserOpener = (address: string) => Promise<unknown>;

export function openBrowserAddress(address: string, opener: BrowserOpener = open): void {
  void Promise.resolve()
    .then(() => opener(address))
    .catch((err: unknown) => {
      warnToTerminal(`Could not open browser at ${address}: ${getErrorMessage(err)}`);
    });
}

export function createReadyHandler(openBrowser = true): (address: string) => void {
  return (address) => {
    printToTerminal(`Diffgazer is running at ${address}`);
    if (openBrowser) {
      openBrowserAddress(address);
    }
  };
}
