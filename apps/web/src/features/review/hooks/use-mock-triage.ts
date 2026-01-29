import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProgressStepData, LogEntryData } from '@/components/ui';

export interface MockTriageState {
  steps: ProgressStepData[];
  entries: LogEntryData[];
  metrics: {
    filesProcessed: number;
    filesTotal: number;
    issuesFound: number;
  };
  isRunning: boolean;
  isComplete: boolean;
  startTime: Date | null;
}

const INITIAL_STEPS: ProgressStepData[] = [
  { id: 'diff', label: 'Collect diff', status: 'pending' },
  { id: 'triage', label: 'Triage issues', status: 'pending' },
  { id: 'enrich', label: 'Enrich context', status: 'pending' },
  { id: 'report', label: 'Generate report', status: 'pending' },
];

const MOCK_LOG_SEQUENCE: Array<Omit<LogEntryData, 'id' | 'timestamp'>> = [
  { tag: 'system', tagType: 'system', message: 'Initializing Stargazer agent...' },
  { tag: 'tool', tagType: 'tool', message: 'getDiff → Collected 7 files' },
  { tag: 'lens', tagType: 'lens', message: 'syntax → Parsing AST... OK' },
  { tag: 'lens', tagType: 'lens', message: 'security → Analyzing src/auth/login.ts' },
  { tag: 'lens', tagType: 'lens', message: 'security → ⚠ Potential SQL Injection detected', isWarning: true },
  { tag: 'tool', tagType: 'tool', message: 'gitBlame → Retrieving commit author for L42' },
  { tag: 'tool', tagType: 'tool', message: 'searchDocs → Querying "safe query builder patterns"' },
  { tag: 'lens', tagType: 'lens', message: 'security → Flagging SQL patterns...' },
  { tag: 'lens', tagType: 'lens', message: 'performance → Scanning for N+1 queries' },
  { tag: 'lens', tagType: 'lens', message: 'performance → ⚠ Memory leak in event loop', isWarning: true },
  { tag: 'tool', tagType: 'tool', message: 'readFile → Loading services/processor.ts' },
  { tag: 'lens', tagType: 'lens', message: 'correctness → Checking error handling...' },
  { tag: 'system', tagType: 'system', message: 'Enriching issue context...' },
  { tag: 'tool', tagType: 'tool', message: 'searchDocs → Finding best practices' },
  { tag: 'system', tagType: 'system', message: 'Generating final report...' },
  { tag: 'system', tagType: 'system', message: 'Analysis complete. Found 12 issues.' },
];

// Timeline: which step is active at which log index
const STEP_TRANSITIONS: Record<number, { stepId: string; status: 'active' | 'completed' }[]> = {
  0: [{ stepId: 'diff', status: 'active' }],
  2: [{ stepId: 'diff', status: 'completed' }, { stepId: 'triage', status: 'active' }],
  12: [{ stepId: 'triage', status: 'completed' }, { stepId: 'enrich', status: 'active' }],
  14: [{ stepId: 'enrich', status: 'completed' }, { stepId: 'report', status: 'active' }],
  15: [{ stepId: 'report', status: 'completed' }],
};

const METRICS_UPDATES: Record<number, { filesProcessed: number; issuesFound: number }> = {
  1: { filesProcessed: 1, issuesFound: 0 },
  4: { filesProcessed: 2, issuesFound: 1 },
  6: { filesProcessed: 3, issuesFound: 2 },
  9: { filesProcessed: 4, issuesFound: 4 },
  11: { filesProcessed: 5, issuesFound: 6 },
  13: { filesProcessed: 6, issuesFound: 9 },
  15: { filesProcessed: 7, issuesFound: 12 },
};

export function useMockTriage(autoStart = false, completionDelayMs = 1500) {
  const [state, setState] = useState<MockTriageState>({
    steps: INITIAL_STEPS,
    entries: [],
    metrics: { filesProcessed: 0, filesTotal: 7, issuesFound: 0 },
    isRunning: false,
    isComplete: false,
    startTime: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cleanup();
    logIndexRef.current = 0;

    setState({
      steps: INITIAL_STEPS,
      entries: [],
      metrics: { filesProcessed: 0, filesTotal: 7, issuesFound: 0 },
      isRunning: true,
      isComplete: false,
      startTime: new Date(),
    });

    intervalRef.current = setInterval(() => {
      const idx = logIndexRef.current;

      if (idx >= MOCK_LOG_SEQUENCE.length) {
        cleanup();
        // Delay before marking complete
        setTimeout(() => {
          setState(prev => ({ ...prev, isRunning: false, isComplete: true }));
        }, completionDelayMs);
        return;
      }

      setState(prev => {
        const newEntry: LogEntryData = {
          id: `log-${idx}`,
          timestamp: new Date(),
          ...MOCK_LOG_SEQUENCE[idx],
        };

        // Update steps if there's a transition at this index
        let newSteps = prev.steps;
        if (STEP_TRANSITIONS[idx]) {
          newSteps = prev.steps.map(step => {
            const transition = STEP_TRANSITIONS[idx].find(t => t.stepId === step.id);
            if (transition) {
              return { ...step, status: transition.status };
            }
            return step;
          });
        }

        // Update metrics if there's an update at this index
        let newMetrics = prev.metrics;
        if (METRICS_UPDATES[idx]) {
          newMetrics = { ...prev.metrics, ...METRICS_UPDATES[idx] };
        }

        return {
          ...prev,
          entries: [...prev.entries, newEntry],
          steps: newSteps,
          metrics: newMetrics,
        };
      });

      logIndexRef.current++;
    }, 400); // 400ms between log entries
  }, [cleanup, completionDelayMs]);

  const stop = useCallback(() => {
    cleanup();
    setState(prev => ({ ...prev, isRunning: false }));
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    logIndexRef.current = 0;
    setState({
      steps: INITIAL_STEPS,
      entries: [],
      metrics: { filesProcessed: 0, filesTotal: 7, issuesFound: 0 },
      isRunning: false,
      isComplete: false,
      startTime: null,
    });
  }, [cleanup]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return cleanup;
  }, [autoStart, start, cleanup]);

  return {
    ...state,
    start,
    stop,
    reset,
  };
}
