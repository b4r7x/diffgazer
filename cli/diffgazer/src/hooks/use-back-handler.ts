import { useInput } from "ink";
import { useNavigation } from "../app/providers/navigation-provider";

interface BackHandlerOptions {
  isActive?: boolean;
}

export function useBackHandler(options: BackHandlerOptions = {}): void {
  const { isActive = true } = options;
  const { goBack, canGoBack } = useNavigation();

  useInput(
    (_input, key) => {
      if (key.escape && canGoBack) {
        goBack();
      }
    },
    { isActive },
  );
}
