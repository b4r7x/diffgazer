import { useInput } from "ink";
import { useNavigation } from "../app/navigation-context.js";

export function useBackHandler(): void {
  const { goBack, canGoBack } = useNavigation();

  useInput((input, key) => {
    if (key.escape && canGoBack) {
      goBack();
    }
  });
}
