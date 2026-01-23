/**
 * Tests for use-review buffer growth protection algorithm
 * Verifies streamedContent remains bounded to prevent OOM
 */

import { describe, it, expect } from 'vitest';

function appendWithBound(
  streamedContent: string,
  newContent: string,
  displayContentLength: number
): string {
  const combinedLength = streamedContent.length + newContent.length;

  if (combinedLength <= displayContentLength) {
    return streamedContent + newContent;
  } else if (newContent.length >= displayContentLength) {
    return newContent.slice(-displayContentLength);
  } else {
    const keepFromOld = displayContentLength - newContent.length;
    return streamedContent.slice(-keepFromOld) + newContent;
  }
}

describe('useReview - Buffer Growth Protection', () => {
  const LIMIT = 500;

  it.each([
    ['empty to non-empty', '', 'New', 'New'],
    ['simple append', 'Hello', ' World', 'Hello World'],
    ['empty new', 'existing', '', 'existing'],
    ['both empty', '', '', ''],
    ['UTF-8 chars', 'Hello 世界', ' 🌍', 'Hello 世界 🌍'],
    ['at limit', 'a'.repeat(200), 'b'.repeat(300), 'a'.repeat(200) + 'b'.repeat(300)],
    ['new at limit', 'old', 'x'.repeat(500), 'x'.repeat(500)],
  ])('%s', (_, old, chunk, expected) => {
    const result = appendWithBound(old, chunk, LIMIT);
    expect(result).toBe(expected);
    expect(result.length).toBeLessThanOrEqual(LIMIT);
  });

  it('preserves order in sequential appends', () => {
    let content = '';
    content = appendWithBound(content, 'AAA', LIMIT);
    content = appendWithBound(content, 'BBB', LIMIT);
    content = appendWithBound(content, 'CCC', LIMIT);

    expect(content).toBe('AAABBBCCC');
  });

  it.each([
    ['new exceeds', 'old', 'x'.repeat(1000), 'x'.repeat(500)],
    ['combined exceeds', 'a'.repeat(400), 'b'.repeat(200), 'a'.repeat(300) + 'b'.repeat(200)],
  ])('truncates when %s limit', (_, old, chunk, expected) => {
    const result = appendWithBound(old, chunk, LIMIT);
    expect(result.length).toBe(LIMIT);
    expect(result).toBe(expected);
  });

  it.each([
    [1],
    [100],
    [1000],
    [10000],
  ])('stays bounded with varying chunk sizes: %d', (size) => {
    let content = '';
    for (let i = 0; i < 10; i++) {
      content = appendWithBound(content, 'x'.repeat(size), LIMIT);
      expect(content.length).toBeLessThanOrEqual(LIMIT);
    }
  });
});
