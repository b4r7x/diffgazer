# React Principles

Load comprehensive React best practices for 2025/2026.

## When to Use

Use this skill when:
- Starting new React component development
- Reviewing React code
- Refactoring existing React code
- Need guidance on hooks, state management, or component design

## Loaded Context

This skill loads the full React principles from `.claude/skills/react-principles.md` including:

1. **Core Philosophy** - No premature optimization, no memoization by default
2. **React 19 Features** - Compiler, new hooks, Server Components
3. **Component Architecture** - Single responsibility, composition patterns
4. **Hooks Deep Dive** - useState, useEffect, useRef, custom hooks
5. **State Management** - Location decisions, colocation, derived state
6. **Memoization Policy** - The THREE allowed cases only
7. **Anti-Patterns** - What to avoid with examples
8. **File Organization** - Project structure conventions
9. **TypeScript** - Typing patterns

## Key Rules Summary

### Memoization: NEVER Use Except

1. **Context Provider values** - `useMemo` on value passed to Provider
2. **useCallback for useEffect + reused** - Function in effect deps AND used elsewhere
3. **PROVEN performance issue** - With profiler data in comment

### State Rules

- Colocate state close to where it's used
- Derive values during render, don't store them
- Use TanStack Query for server state, not Redux/useState

### Component Rules

- Single responsibility
- Functional components only (except Error Boundaries)
- Split at 150+ lines or 3+ concerns

### Hook Rules

- Always clean up useEffect (listeners, timers, subscriptions)
- Include all dependencies
- Move functions inside useEffect if only used there
- Use functional updates to avoid stale closures

## Usage

After loading, apply these principles to all React code you write or review.
