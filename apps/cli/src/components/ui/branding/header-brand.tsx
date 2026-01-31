import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useFiglet, type FigletFont } from "@repo/hooks";
import { useTerminalDimensions } from "../../../hooks/index.js";

interface HeaderBrandProps {
  showStars?: boolean;
  color?: string;
}

// Breakpoints for header sizes
const LARGE_BREAKPOINT = 100;
const MEDIUM_BREAKPOINT = 70;

const STARS_LEFT = " *  .  *  ";
const STARS_RIGHT = "  .  *  . ";
const STARS_LEFT_REVERSED = "  *  .  * ";
const STARS_RIGHT_REVERSED = " .  *  .  ";

type HeaderSize = "large" | "medium" | "small";

const FONT_MAP: Record<HeaderSize, FigletFont | null> = {
  large: "Big",
  medium: "Small",
  small: null,
};

function getHeaderSize(columns: number): HeaderSize {
  if (columns >= LARGE_BREAKPOINT) return "large";
  if (columns >= MEDIUM_BREAKPOINT) return "medium";
  return "small";
}

export function HeaderBrand({
  showStars = true,
  color = "cyan",
}: HeaderBrandProps): ReactElement {
  const { columns, isTiny } = useTerminalDimensions();
  const headerSize = getHeaderSize(columns);
  const font = FONT_MAP[headerSize];

  const { text: figletText, isLoading } = useFiglet("Stargazer", font ?? "Big");

  if (isTiny) {
    return <MiniBrand color={color} />;
  }

  if (headerSize === "small") {
    return <CompactBrand color={color} />;
  }

  const bannerLines = isLoading || !figletText
    ? []
    : figletText.split("\n").filter(line => line.trim() !== "");

  const displayStars = showStars && headerSize === "large";

  return (
    <Box flexDirection="column" alignItems="center">
      {bannerLines.map((line, i) => (
        <Box key={i}>
          {displayStars && (
            <Text dimColor>
              {i % 2 === 0 ? STARS_LEFT : STARS_LEFT_REVERSED}
            </Text>
          )}
          <Text color={color} bold>
            {line}
          </Text>
          {displayStars && (
            <Text dimColor>
              {i % 2 === 0 ? STARS_RIGHT : STARS_RIGHT_REVERSED}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function CompactBrand({ color = "cyan" }: { color?: string }): ReactElement {
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

export function MiniBrand({ color = "cyan" }: { color?: string }): ReactElement {
  return (
    <Text color={color} bold>
      Stargazer
    </Text>
  );
}
