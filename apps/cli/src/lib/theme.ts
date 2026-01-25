import chalk, { type ChalkInstance } from "chalk";
import type { Theme } from "@repo/schemas/settings";

export interface ThemeColors {
  severity: {
    blocker: string;
    high: string;
    medium: string;
    low: string;
    nit: string;
  };
  status: {
    pending: string;
    running: string;
    complete: string;
    failed: string;
    skipped: string;
  };
  diff: {
    addition: string;
    deletion: string;
    hunkHeader: string;
    context: string;
  };
  ui: {
    border: string;
    borderFocused: string;
    text: string;
    textMuted: string;
    textDim: string;
    accent: string;
    success: string;
    error: string;
    warning: string;
    info: string;
  };
}

export interface ThemeTokens {
  text: {
    primary: ChalkInstance;
    secondary: ChalkInstance;
    muted: ChalkInstance;
    inverse: ChalkInstance;
  };
  status: {
    success: ChalkInstance;
    error: ChalkInstance;
    warning: ChalkInstance;
    info: ChalkInstance;
  };
  severity: {
    blocker: ChalkInstance;
    high: ChalkInstance;
    medium: ChalkInstance;
    low: ChalkInstance;
    nit: ChalkInstance;
  };
  ui: {
    border: ChalkInstance;
    borderFocus: ChalkInstance;
    background: ChalkInstance;
    highlight: ChalkInstance;
  };
  diff: {
    added: ChalkInstance;
    removed: ChalkInstance;
    context: ChalkInstance;
  };
  modifiers: {
    bold: ChalkInstance;
    dim: ChalkInstance;
    italic: ChalkInstance;
  };
}

const darkTheme: ThemeTokens = {
  text: {
    primary: chalk.white,
    secondary: chalk.gray,
    muted: chalk.dim,
    inverse: chalk.black.bgWhite,
  },
  status: {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.cyan,
  },
  severity: {
    blocker: chalk.red.bold,
    high: chalk.magenta,
    medium: chalk.yellow,
    low: chalk.blue,
    nit: chalk.gray,
  },
  ui: {
    border: chalk.gray,
    borderFocus: chalk.cyan,
    background: chalk.bgBlack,
    highlight: chalk.bgCyan.black,
  },
  diff: {
    added: chalk.green,
    removed: chalk.red,
    context: chalk.gray,
  },
  modifiers: {
    bold: chalk.bold,
    dim: chalk.dim,
    italic: chalk.italic,
  },
};

const lightTheme: ThemeTokens = {
  text: {
    primary: chalk.black,
    secondary: chalk.gray,
    muted: chalk.dim,
    inverse: chalk.white.bgBlack,
  },
  status: {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.hex("#B8860B"),
    info: chalk.blue,
  },
  severity: {
    blocker: chalk.red.bold,
    high: chalk.hex("#8B008B"),
    medium: chalk.hex("#B8860B"),
    low: chalk.blue,
    nit: chalk.gray,
  },
  ui: {
    border: chalk.gray,
    borderFocus: chalk.blue,
    background: chalk.bgWhite,
    highlight: chalk.bgBlue.white,
  },
  diff: {
    added: chalk.green,
    removed: chalk.red,
    context: chalk.gray,
  },
  modifiers: {
    bold: chalk.bold,
    dim: chalk.dim,
    italic: chalk.italic,
  },
};

const terminalTheme: ThemeTokens = {
  text: {
    primary: chalk.reset,
    secondary: chalk.dim,
    muted: chalk.dim,
    inverse: chalk.inverse,
  },
  status: {
    success: chalk.bold,
    error: chalk.bold,
    warning: chalk.dim,
    info: chalk.reset,
  },
  severity: {
    blocker: chalk.bold.underline,
    high: chalk.bold,
    medium: chalk.reset,
    low: chalk.dim,
    nit: chalk.dim,
  },
  ui: {
    border: chalk.dim,
    borderFocus: chalk.bold,
    background: chalk.reset,
    highlight: chalk.inverse,
  },
  diff: {
    added: chalk.bold,
    removed: chalk.dim.strikethrough,
    context: chalk.reset,
  },
  modifiers: {
    bold: chalk.bold,
    dim: chalk.dim,
    italic: chalk.italic,
  },
};

export function supportsColors(): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }
  if (!process.stdout.isTTY) {
    return false;
  }
  const term = process.env.TERM ?? "";
  if (term === "dumb") {
    return false;
  }
  return chalk.level > 0;
}

export function supportsUnicode(): boolean {
  if (process.platform === "win32") {
    return (
      process.env.WT_SESSION !== undefined ||
      process.env.TERM_PROGRAM === "vscode" ||
      process.env.TERM === "xterm-256color"
    );
  }
  const lang = process.env.LANG ?? "";
  const lcAll = process.env.LC_ALL ?? "";
  return lang.includes("UTF-8") || lcAll.includes("UTF-8") || process.stdout.isTTY === true;
}

function detectTheme(): ThemeTokens {
  if (!supportsColors()) {
    return terminalTheme;
  }
  const colorScheme = process.env.COLORFGBG;
  if (colorScheme) {
    const [fg, bg] = colorScheme.split(";");
    if (bg === "15" || bg === "7") {
      return lightTheme;
    }
    if (bg === "0" || bg === "8") {
      return darkTheme;
    }
  }
  if (process.env.TERM_PROGRAM === "Apple_Terminal") {
    return lightTheme;
  }
  return darkTheme;
}

export function getTheme(name: Theme): ThemeTokens {
  switch (name) {
    case "auto":
      return detectTheme();
    case "dark":
      return darkTheme;
    case "light":
      return lightTheme;
    case "terminal":
      return terminalTheme;
  }
}

const darkColors: ThemeColors = {
  severity: {
    blocker: "red",
    high: "magenta",
    medium: "yellow",
    low: "blue",
    nit: "gray",
  },
  status: {
    pending: "gray",
    running: "cyan",
    complete: "green",
    failed: "red",
    skipped: "yellow",
  },
  diff: {
    addition: "green",
    deletion: "red",
    hunkHeader: "cyan",
    context: "white",
  },
  ui: {
    border: "gray",
    borderFocused: "cyan",
    text: "white",
    textMuted: "gray",
    textDim: "gray",
    accent: "cyan",
    success: "green",
    error: "red",
    warning: "yellow",
    info: "cyan",
  },
};

const lightColors: ThemeColors = {
  severity: {
    blocker: "red",
    high: "magenta",
    medium: "yellow",
    low: "blue",
    nit: "gray",
  },
  status: {
    pending: "gray",
    running: "cyan",
    complete: "green",
    failed: "red",
    skipped: "yellow",
  },
  diff: {
    addition: "greenBright",
    deletion: "redBright",
    hunkHeader: "cyanBright",
    context: "black",
  },
  ui: {
    border: "blackBright",
    borderFocused: "blue",
    text: "black",
    textMuted: "gray",
    textDim: "gray",
    accent: "blue",
    success: "green",
    error: "red",
    warning: "yellow",
    info: "blue",
  },
};

const terminalColors: ThemeColors = {
  severity: {
    blocker: "white",
    high: "white",
    medium: "white",
    low: "white",
    nit: "gray",
  },
  status: {
    pending: "gray",
    running: "white",
    complete: "white",
    failed: "white",
    skipped: "gray",
  },
  diff: {
    addition: "white",
    deletion: "gray",
    hunkHeader: "white",
    context: "white",
  },
  ui: {
    border: "gray",
    borderFocused: "white",
    text: "white",
    textMuted: "gray",
    textDim: "gray",
    accent: "white",
    success: "white",
    error: "white",
    warning: "white",
    info: "white",
  },
};

function detectThemeColors(): ThemeColors {
  if (!supportsColors()) {
    return terminalColors;
  }
  const colorScheme = process.env.COLORFGBG;
  if (colorScheme) {
    const [, bg] = colorScheme.split(";");
    if (bg === "15" || bg === "7") {
      return lightColors;
    }
    if (bg === "0" || bg === "8") {
      return darkColors;
    }
  }
  if (process.env.TERM_PROGRAM === "Apple_Terminal") {
    return lightColors;
  }
  return darkColors;
}

export function getThemeColors(name: Theme): ThemeColors {
  switch (name) {
    case "auto":
      return detectThemeColors();
    case "dark":
      return darkColors;
    case "light":
      return lightColors;
    case "terminal":
      return terminalColors;
  }
}
