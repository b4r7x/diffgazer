import type { ReactElement } from "react";
import { Text } from "ink";
import { Separator } from "../ui/separator.js";

interface SettingsHeaderProps {
  title?: string;
}

export function SettingsHeader({ title = "Stargazer Settings" }: SettingsHeaderProps): ReactElement {
  return (
    <>
      <Text bold color="cyan">{title}</Text>
      <Separator width={20} />
    </>
  );
}
