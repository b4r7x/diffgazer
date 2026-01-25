import type { ReactElement } from "react";
import { Box, Text } from "ink";

interface HeaderBrandProps {
  showStars?: boolean;
  color?: string;
}

const BANNER_LINES = [
  " _____ _                                       ",
  "/  ___| |                                      ",
  "\\ `--.| |_ __ _ _ __ __ _  __ _ _______ _ __  ",
  " `--. \\ __/ _` | '__/ _` |/ _` |_  / _ \\ '__| ",
  "/\\__/ / || (_| | | | (_| | (_| |/ /  __/ |    ",
  "\\____/ \\__\\__,_|_|  \\__, |\\__,_/___\\___|_|    ",
  "                     __/ |                     ",
  "                    |___/                      ",
];

const STARS_LEFT = " *  .  *  ";
const STARS_RIGHT = "  .  *  . ";

export function HeaderBrand({
  showStars = true,
  color = "cyan",
}: HeaderBrandProps): ReactElement {
  return (
    <Box flexDirection="column" alignItems="center">
      {BANNER_LINES.map((line, i) => (
        <Box key={i}>
          {showStars && (
            <Text dimColor>
              {i % 2 === 0 ? STARS_LEFT : STARS_LEFT.split("").reverse().join("")}
            </Text>
          )}
          <Text color={color} bold>
            {line}
          </Text>
          {showStars && (
            <Text dimColor>
              {i % 2 === 0 ? STARS_RIGHT : STARS_RIGHT.split("").reverse().join("")}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

interface CompactBrandProps {
  color?: string;
}

export function CompactBrand({ color = "cyan" }: CompactBrandProps): ReactElement {
  return (
    <Box>
      <Text dimColor>* </Text>
      <Text color={color} bold>
        STARGAZER
      </Text>
      <Text dimColor> *</Text>
    </Box>
  );
}
