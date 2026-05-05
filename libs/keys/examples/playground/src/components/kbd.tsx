const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

const keyMap: Record<string, [mac: string, other: string]> = {
  mod: ["\u2318", "Ctrl"],
  shift: ["\u21e7", "Shift"],
  alt: ["\u2325", "Alt"],
  arrowup: ["\u2191", "\u2191"],
  arrowdown: ["\u2193", "\u2193"],
  arrowleft: ["\u2190", "\u2190"],
  arrowright: ["\u2192", "\u2192"],
  escape: ["Esc", "Esc"],
  enter: ["\u21b5", "Enter"],
  space: ["Space", "Space"],
  backspace: ["\u232b", "Backspace"],
};

interface KbdProps {
  keys: string;
}

export function Kbd({ keys }: KbdProps) {
  const segments = keys.split("+");

  return (
    <span>
      {segments.map((seg, i) => {
        const mapped = keyMap[seg.toLowerCase()];
        const label = mapped ? (isMac ? mapped[0] : mapped[1]) : seg;
        return (
          <kbd key={i} className="kbd">
            {label}
          </kbd>
        );
      })}
    </span>
  );
}
