"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { getFigletText } from "@/components/ui/logo/figlet";

export default function LogoFiglet() {
  const [bigText, setBigText] = useState<string>();
  const [smallText, setSmallText] = useState<string>();

  useEffect(() => {
    getFigletText("DG", "Big").then(setBigText);
    getFigletText("diffgazer", "Small").then(setSmallText);
  }, []);

  return (
    <div className="space-y-4">
      <Logo text="DG" asciiText={bigText} className="text-foreground text-[8px]" />
      <Logo text="diffgazer" asciiText={smallText} className="text-success text-[8px]" />
    </div>
  );
}
