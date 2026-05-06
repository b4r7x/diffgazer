# QLT-017 - Pure display primitives are unnecessarily client components

**Area**: RSC compatibility  
**Severity**: Medium  
**Effort**: Medium  
**Status**: Open

## Problem

Some display-only primitives can be marked `"use client"` despite not needing hooks, effects, browser APIs, or context.

## Evidence

- Recheck display primitives in `libs/ui/registry/ui`: badge, card, divider, typography, panel, section-header, kbd, logo, toc, and similar static components.

## User Impact

Server-component consumers pay unnecessary client bundle cost and lose server-rendering ergonomics.

## Fix

Remove unnecessary client directives from pure components while preserving required directives for interactive components.

## Acceptance Criteria

- Pure display primitives can be imported in server components.
- Client directives exist only where needed.

## Verification

- Next App Router fixture importing display primitives in server components.

