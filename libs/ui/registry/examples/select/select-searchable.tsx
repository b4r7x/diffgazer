"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectSearch,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectSearchable() {
  const [value, setValue] = useState<string>("");

  return (
    <div className="w-64">
      <Select value={value} onChange={setValue}>
        <SelectTrigger aria-label="Command">
          <SelectValue placeholder="Search commands..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="git-add">git add</SelectItem>
          <SelectItem value="git-commit">git commit</SelectItem>
          <SelectItem value="git-push">git push</SelectItem>
          <SelectItem value="git-pull">git pull</SelectItem>
          <SelectItem value="git-stash">git stash</SelectItem>
          <SelectItem value="git-rebase">git rebase</SelectItem>
          <SelectItem value="git-cherry-pick">git cherry-pick</SelectItem>
          <SelectEmpty />
          <SelectSearch placeholder="Filter..." />
        </SelectContent>
      </Select>
    </div>
  );
}
