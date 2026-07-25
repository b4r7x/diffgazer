"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectOpen() {
  const [value, setValue] = useState<string[]>(["git-commit"]);

  return (
    <div className="w-64 h-56">
      <Select multiple defaultOpen value={value} onChange={setValue}>
        <SelectTrigger aria-label="Commands">
          <SelectValue placeholder="Select commands..." display="list" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="git-add">git add</SelectItem>
          <SelectItem value="git-commit">git commit</SelectItem>
          <SelectItem value="git-push">git push</SelectItem>
          <SelectItem value="git-stash" disabled>
            git stash
          </SelectItem>
          <SelectItem value="git-rebase">git rebase</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
