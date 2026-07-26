import { z } from "zod";

// Keep zod off its Function-constructor JIT: the docs CSP forbids eval.
z.config({ jitless: true });
