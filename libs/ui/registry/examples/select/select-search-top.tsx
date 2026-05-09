"use client";

import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSearch,
  SelectEmpty,
  SelectValue,
} from "@/components/ui/select"

export default function SelectSearchTop() {
  const [value, setValue] = useState<string>("")

  return (
    <Select width="md" value={value} onChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select a command..." />
      </SelectTrigger>
      <SelectContent>
        <SelectSearch position="top" placeholder="Search commands..." />
        <SelectItem value="git-add">git add</SelectItem>
        <SelectItem value="git-commit">git commit</SelectItem>
        <SelectItem value="git-push">git push</SelectItem>
        <SelectItem value="git-pull">git pull</SelectItem>
        <SelectItem value="git-stash">git stash</SelectItem>
        <SelectItem value="git-rebase">git rebase</SelectItem>
        <SelectItem value="git-cherry-pick">git cherry-pick</SelectItem>
        <SelectEmpty />
      </SelectContent>
    </Select>
  )
}
