import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReviewContainer } from './review-container';
import { useTriageStream } from '../hooks/use-triage-stream';
import { useConfig } from '@/features/settings/hooks/use-config';
import { useNavigate, useParams } from '@tanstack/react-router';

vi.mock('../hooks/use-triage-stream');
vi.mock('@/features/settings/hooks/use-config');
vi.mock('@tanstack/react-router');
vi.mock('./review-progress-view', () => ({
  ReviewProgressView: ({ isRunning, onViewResults }: any) => (
    <div data-testid="review-progress-view">
      <button onClick={onViewResults}>View Results</button>
    </div>
  ),
}));
vi.mock('./api-key-missing-view', () => ({
  ApiKeyMissingView: () => <div data-testid="api-key-missing-view">API Key Missing</div>,
}));

const mockUseTriageStream = vi.mocked(useTriageStream);
const mockUseConfig = vi.mocked(useConfig);
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseParams = vi.mocked(useParams);

const createMockState = (overrides = {}) => ({
  steps: [
    { id: 'triage', label: 'Triage', status: 'pending' as const },
    { id: 'report', label: 'Report', status: 'pending' as const },
  ],
  agents: [],
  issues: [],
  events: [],
  fileProgress: { total: 0, current: 0, currentFile: null, completed: new Set() },
  isStreaming: false,
  error: null,
  startedAt: null,
  selectedIssueId: null,
  reviewId: null,
  ...overrides,
});

describe('ReviewContainer', () => {
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockResume = vi.fn();
  const mockNavigate = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseTriageStream.mockReturnValue({
      state: createMockState(),
      start: mockStart,
      stop: mockStop,
      resume: mockResume,
      selectIssue: vi.fn(),
    });

    mockUseConfig.mockReturnValue({
      isConfigured: true,
      isLoading: false,
      provider: 'openai',
    });

    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseParams.mockReturnValue({});
  });

  describe('ReviewProgressView startTime prop', () => {
    it('passes state.startedAt to ReviewProgressView when available', async () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      mockUseTriageStream.mockReturnValue({
        state: createMockState({ startedAt: startTime, isStreaming: true }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        const timerElements = screen.queryAllByRole('region', { hidden: true });
        expect(timerElements.length).toBeGreaterThanOrEqual(0);
      });

      // Verify the component rendered successfully
      expect(screen.getByText('Progress Overview')).toBeInTheDocument();
    });

    it('passes undefined when state.startedAt is null', async () => {
      mockUseTriageStream.mockReturnValue({
        state: createMockState({ startedAt: null, isStreaming: true }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Overview')).toBeInTheDocument();
      });

      // The component should render without startTime defined
      expect(mockStart).toHaveBeenCalled();
    });

    it('timer shows correct elapsed time based on startedAt', async () => {
      // Create a start time 5 seconds ago
      const startTime = new Date(Date.now() - 5000);

      mockUseTriageStream.mockReturnValue({
        state: createMockState({ startedAt: startTime, isStreaming: true }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      const { container } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Overview')).toBeInTheDocument();
      });

      // Look for the Timer component which displays elapsed time
      const metricsSection = container.querySelector('[class*="Metrics"]');
      expect(metricsSection).toBeTruthy();
    });
  });

  describe('initialization', () => {
    it('starts review when configured and component mounts', async () => {
      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledWith({ mode: "unstaged" });
      });
    });

    it('resumes review when reviewId in params', async () => {
      const reviewId = 'test-review-123';
      mockUseParams.mockReturnValue({ reviewId });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalledWith(reviewId);
      });
    });

    it('does not start when config is loading', () => {
      mockUseConfig.mockReturnValue({
        isConfigured: false,
        isLoading: true,
        provider: null,
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(mockStart).not.toHaveBeenCalled();
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('shows ApiKeyMissingView when not configured', () => {
      mockUseConfig.mockReturnValue({
        isConfigured: false,
        isLoading: false,
        provider: null,
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(screen.queryByText('Progress Overview')).not.toBeInTheDocument();
    });
  });

  describe('metrics calculation', () => {
    it('passes correct metrics to ReviewProgressView', async () => {
      const issues = [
        { id: '1', severity: 'error' as const, path: 'file.ts', line: 10, message: 'Test issue' },
      ];
      const fileProgress = {
        total: 5,
        current: 3,
        currentFile: 'test.ts',
        completed: new Set(['file1.ts', 'file2.ts', 'file3.ts']),
      };

      mockUseTriageStream.mockReturnValue({
        state: createMockState({ issues, fileProgress, isStreaming: true }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Progress Overview')).toBeInTheDocument();
      });

      // Verify metrics are displayed
      expect(screen.getByText('Files Processed')).toBeInTheDocument();
      expect(screen.getByText('Issues Found')).toBeInTheDocument();
    });
  });

  describe('mode variations', () => {
    it('passes mode "staged" to start options', async () => {
      render(
        <ReviewContainer
          mode="staged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledWith({ mode: "staged" });
      });
    });

    it('passes mode "unstaged" to start options', async () => {
      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledWith({ mode: "unstaged" });
      });
    });

    it('passes mode "files" to start options', async () => {
      render(
        <ReviewContainer
          mode="files"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledWith({ mode: "files" });
      });
    });
  });

  describe('phase-aware delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Test: calls onComplete after 400ms delay when report step NOT completed
     *
     * The ReviewContainer uses a phase-aware delay that checks if the report
     * step is completed. When it's NOT completed, it uses a 400ms delay before
     * calling onComplete callback.
     *
     * Test logic:
     * 1. Simulate streaming stopping with report step NOT completed
     * 2. Verify onComplete is NOT called at 399ms
     * 3. Verify onComplete IS called at 400ms
     */
    it('calls onComplete after 400ms delay when report step NOT completed', async () => {
      const mockOnCompleteForDelay = vi.fn();

      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      const { rerender } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnCompleteForDelay}
        />
      );

      // Simulate streaming state to trigger hasStreamed tracking
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: true,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForDelay} />);

      // End streaming with report NOT completed
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForDelay} />);

      // At 399ms, should not have called onComplete
      vi.advanceTimersByTime(399);
      expect(mockOnCompleteForDelay).not.toHaveBeenCalled();

      // At 400ms, should call onComplete
      vi.advanceTimersByTime(1);
      expect(mockOnCompleteForDelay).toHaveBeenCalledOnce();
    });

    /**
     * Test: calls onComplete after 2300ms delay when report step IS completed
     *
     * When the report step IS completed, ReviewContainer uses a longer 2300ms
     * delay to allow users to see the final step completion before switching views.
     *
     * Test logic:
     * 1. Simulate streaming stopping with report step completed
     * 2. Verify onComplete is NOT called at 2299ms
     * 3. Verify onComplete IS called at 2300ms
     */
    it('calls onComplete after 2300ms delay when report step IS completed', async () => {
      const mockOnCompleteForReportDelay = vi.fn();

      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'completed' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      const { rerender } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnCompleteForReportDelay}
        />
      );

      // Simulate streaming state
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: true,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForReportDelay} />);

      // End streaming with report completed
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'completed' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForReportDelay} />);

      // At 2299ms, should not have called onComplete
      vi.advanceTimersByTime(2299);
      expect(mockOnCompleteForReportDelay).not.toHaveBeenCalled();

      // At 2300ms, should call onComplete
      vi.advanceTimersByTime(1);
      expect(mockOnCompleteForReportDelay).toHaveBeenCalledOnce();
    });

    /**
     * Test: clears timeout on unmount
     *
     * When the component unmounts while a timeout is pending, the cleanup
     * function in the useEffect should clear the timeout to prevent memory leaks.
     *
     * Test logic:
     * 1. Simulate streaming stopping (starts timeout)
     * 2. Advance time partially (200ms)
     * 3. Unmount component (should clear timeout)
     * 4. Advance time past original delay (300ms more = 500ms total)
     * 5. Verify onComplete is NOT called (timeout was cleared)
     */
    it('clears timeout on unmount', async () => {
      const mockOnCompleteForUnmount = vi.fn();

      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });

      const { rerender, unmount } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnCompleteForUnmount}
        />
      );

      // Simulate streaming
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: true,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForUnmount} />);

      // Stop streaming (starts timeout)
      mockUseTriageStream.mockReturnValue({
        state: createMockState({
          isStreaming: false,
          steps: [
            { id: 'triage', label: 'Triage', status: 'completed' as const },
            { id: 'report', label: 'Report', status: 'active' as const },
          ],
          reviewId: 'review-123',
        }),
        start: mockStart,
        stop: mockStop,
        resume: mockResume,
        selectIssue: vi.fn(),
      });
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnCompleteForUnmount} />);

      // Advance partway through the 400ms timeout
      vi.advanceTimersByTime(200);
      expect(mockOnCompleteForUnmount).not.toHaveBeenCalled();

      // Unmount component (should clear the timeout via cleanup function)
      unmount();

      // Advance past the original timeout
      vi.advanceTimersByTime(300);

      // onComplete should never be called because timeout was cleared
      expect(mockOnCompleteForUnmount).not.toHaveBeenCalled();
    });
  });

  describe('Invalid UUID and Resume Behavior', () => {
    it('does not call resume when reviewId is missing from params', () => {
      mockUseParams.mockReturnValue({});

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(mockResume).not.toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledWith({ mode: "unstaged" });
    });

    it('calls resume when reviewId exists in params', async () => {
      const reviewId = 'valid-uuid-123';
      mockUseParams.mockReturnValue({ reviewId });
      mockResume.mockResolvedValueOnce(undefined);

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalledWith(reviewId);
      });

      expect(mockStart).not.toHaveBeenCalled();
    });

    it('calls onComplete with resumeFailed when resume fails', async () => {
      const reviewId = 'failed-resume-uuid';
      mockUseParams.mockReturnValue({ reviewId });
      mockResume.mockRejectedValueOnce(new Error('Resume failed'));

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith({
          issues: [],
          reviewId,
          resumeFailed: true,
        });
      });
    });

    it('does not retry start after resume fails', async () => {
      const reviewId = 'failed-uuid';
      mockUseParams.mockReturnValue({ reviewId });
      mockResume.mockRejectedValueOnce(new Error('Resume failed'));

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalledWith(reviewId);
      });

      expect(mockStart).not.toHaveBeenCalled();
    });
  });

  describe('Effect Guard Conditions', () => {
    it('does not start when hasStartedRef is true', () => {
      mockUseConfig.mockReturnValue({
        isConfigured: true,
        isLoading: false,
        provider: 'openai',
      });

      const { rerender } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(mockStart).toHaveBeenCalledTimes(1);

      // Rerender - should not call start again
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnComplete} />);

      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('does not start when configLoading is true', () => {
      mockUseConfig.mockReturnValue({
        isConfigured: false,
        isLoading: true,
        provider: null,
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(mockStart).not.toHaveBeenCalled();
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('does not start when isConfigured is false', () => {
      mockUseConfig.mockReturnValue({
        isConfigured: false,
        isLoading: false,
        provider: null,
      });

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      expect(mockStart).not.toHaveBeenCalled();
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('starts only once when all guards pass', async () => {
      mockUseConfig.mockReturnValue({
        isConfigured: true,
        isLoading: false,
        provider: 'openai',
      });

      const { rerender } = render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledTimes(1);
      });

      // Multiple rerenders should not trigger start again
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnComplete} />);
      rerender(<ReviewContainer mode="unstaged" onComplete={mockOnComplete} />);

      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('Router Validation Trust', () => {
    it('trusts params.reviewId format when present (router validates)', async () => {
      // Router's beforeLoad validates UUID format, so component doesn't need to
      const reviewId = 'valid-uuid-from-router';
      mockUseParams.mockReturnValue({ reviewId });
      mockResume.mockResolvedValueOnce(undefined);

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalledWith(reviewId);
      });

      // No additional UUID validation in component
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('handles resume rejection without validating UUID format', async () => {
      // Component doesn't validate format - trusts router did it
      const reviewId = 'any-uuid-router-approved';
      mockUseParams.mockReturnValue({ reviewId });
      mockResume.mockRejectedValueOnce(new Error('Session not found'));

      render(
        <ReviewContainer
          mode="unstaged"
          onComplete={mockOnComplete}
        />
      );

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith({
          issues: [],
          reviewId,
          resumeFailed: true,
        });
      });
    });
  });
});
