---
"@diffgazer/ui": patch
---

Two `ScrollArea` overlay-scrollbar fixes. A scroll area that turns its overlay thumb
back on — because `overlay` or `orientation` changed while it stayed mounted — now
shows the thumb immediately; it used to come back invisible and stay that way until the
reader scrolled or the container resized. Hovering the thumb also picks up its hover
color reliably, where a competing rule could previously win and leave it unhighlighted.
