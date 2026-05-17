---
"@diffgazer/ui": minor
---

Normalize public form-like controls on `value`/`defaultValue`/`onChange(value)`
instead of `onValueChange`. Native wrappers such as `Input` and `Textarea` keep
React's native `onChange(event)` contract.
