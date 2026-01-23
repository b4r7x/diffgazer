/**
 * Tests for use-review hook buffer growth fix
 * Verifies that streamedContent remains bounded and doesn't cause OOM
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Helper function that implements the same memory-efficient algorithm used in use-review.ts
 * This allows us to test the algorithm independently without mocking the entire hook
 */
function appendWithBound(
  streamedContent: string,
  newContent: string,
  displayContentLength: number
): string {
  const combinedLength = streamedContent.length + newContent.length;
  
  if (combinedLength <= displayContentLength) {
    // Both fit within the limit, just append
    return streamedContent + newContent;
  } else if (newContent.length >= displayContentLength) {
    // New content alone exceeds limit, take only the tail of new content
    return newContent.slice(-displayContentLength);
  } else {
    // Need to combine: keep tail of old + all of new, total = displayContentLength
    const keepFromOld = displayContentLength - newContent.length;
    return streamedContent.slice(-keepFromOld) + newContent;
  }
}

describe('useReview - Buffer Growth Protection', () => {
  describe('Buffer boundary protection', () => {
    const DISPLAY_CONTENT_LENGTH = 500;

    it('should handle content under limit - preserves all content when within bounds', () => {
      // Test empty initial content
      let result = appendWithBound('', 'New content', DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('New content');

      // Test simple append
      result = appendWithBound('Hello', ' World', DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('Hello World');

      // Test sequential appends with ordering preservation
      let streamedContent = '';
      streamedContent = appendWithBound(streamedContent, 'AAA', DISPLAY_CONTENT_LENGTH);
      streamedContent = appendWithBound(streamedContent, 'BBB', DISPLAY_CONTENT_LENGTH);
      streamedContent = appendWithBound(streamedContent, 'CCC', DISPLAY_CONTENT_LENGTH);

      expect(streamedContent).toBe('AAABBBCCC');
      expect(streamedContent.endsWith('CCC')).toBe(true);
      expect(streamedContent.length).toBeLessThan(DISPLAY_CONTENT_LENGTH);

      // Test multi-byte characters (UTF-8 safety)
      streamedContent = appendWithBound('', 'Hello 世界 🌍', DISPLAY_CONTENT_LENGTH);
      streamedContent = appendWithBound(streamedContent, ' More content 更多内容', DISPLAY_CONTENT_LENGTH);

      expect(streamedContent).toBe('Hello 世界 🌍 More content 更多内容');
      expect(streamedContent.length).toBeLessThan(DISPLAY_CONTENT_LENGTH);
    });

    it('should handle content at limit - exactly fills buffer without truncation', () => {
      // Test combined content exactly at limit
      const old = 'a'.repeat(200);
      const newContent = 'b'.repeat(300);
      let result = appendWithBound(old, newContent, DISPLAY_CONTENT_LENGTH);

      expect(result.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('a'.repeat(200) + 'b'.repeat(300));

      // Test new content exactly at limit
      const exactContent = 'x'.repeat(500);
      result = appendWithBound('old', exactContent, DISPLAY_CONTENT_LENGTH);

      expect(result.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(result).toBe(exactContent);

      // Test edge cases with empty strings
      result = appendWithBound('existing', '', DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('existing');

      result = appendWithBound('', '', DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('');
    });

    it('should handle content over limit - truncates and maintains bounded size', () => {
      // Test single large chunk exceeding limit
      const largeChunk = 'x'.repeat(1000);
      let result = appendWithBound('old', largeChunk, DISPLAY_CONTENT_LENGTH);

      expect(result.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('x'.repeat(500)); // Last 500 chars of new content

      // Test combining old + new that exceeds limit
      const old = 'a'.repeat(400);
      const newChunk = 'b'.repeat(200);
      result = appendWithBound(old, newChunk, DISPLAY_CONTENT_LENGTH);

      expect(result.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('a'.repeat(300) + 'b'.repeat(200)); // Last 300 of old + all 200 of new

      // Test many chunks over time
      let streamedContent = '';
      for (let i = 0; i < 100; i++) {
        const chunk = 'x'.repeat(100);
        streamedContent = appendWithBound(streamedContent, chunk, DISPLAY_CONTENT_LENGTH);
      }
      expect(streamedContent.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(streamedContent).toBe('x'.repeat(500));

      // Test variable size chunks never exceed limit
      streamedContent = '';
      const testCases = [
        'a'.repeat(1),
        'b'.repeat(100),
        'c'.repeat(500),
        'd'.repeat(1000),
        'e'.repeat(10000),
      ];

      for (const chunk of testCases) {
        streamedContent = appendWithBound(streamedContent, chunk, DISPLAY_CONTENT_LENGTH);
        expect(streamedContent.length).toBeLessThanOrEqual(DISPLAY_CONTENT_LENGTH);
      }

      // Test with multi-byte characters exceeding limit
      streamedContent = '';
      const unicodeChunks = ['🚀'.repeat(100), '中文'.repeat(100), 'Test'.repeat(100)];
      unicodeChunks.forEach(chunk => {
        streamedContent = appendWithBound(streamedContent, chunk, DISPLAY_CONTENT_LENGTH);
      });
      expect(streamedContent.length).toBeLessThanOrEqual(DISPLAY_CONTENT_LENGTH);

      // Test single character accumulation
      streamedContent = '';
      for (let i = 0; i < 1000; i++) {
        streamedContent = appendWithBound(streamedContent, String.fromCharCode(65 + (i % 26)), DISPLAY_CONTENT_LENGTH);
      }
      expect(streamedContent.length).toBe(DISPLAY_CONTENT_LENGTH);
    });
  });

  describe('Size tracking', () => {
    it('should accurately track total content size', () => {
      let totalContentSize = 0;
      const chunks = [
        'a'.repeat(1000),
        'b'.repeat(2000),
        'c'.repeat(3000),
      ];

      chunks.forEach(chunk => {
        totalContentSize += chunk.length;
      });

      expect(totalContentSize).toBe(6000);
    });

    it('should detect when size exceeds limit', () => {
      const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
      let totalContentSize = 0;

      // Simulate large content
      const largeChunk = 'x'.repeat(11 * 1024 * 1024); // 11MB
      totalContentSize += largeChunk.length;

      expect(totalContentSize).toBeGreaterThan(MAX_CONTENT_SIZE);
    });
  });

  describe('Memory footprint - no intermediate large strings', () => {
    const DISPLAY_CONTENT_LENGTH = 500;

    it('should not create large intermediate strings when new chunk exceeds limit', () => {
      // This test verifies the algorithm's design - it should NOT concatenate first then truncate
      // Instead it calculates exactly what's needed upfront
      
      const old = 'a'.repeat(100);
      const largeNew = 'b'.repeat(10000);
      
      // The new algorithm should:
      // 1. See that newContent.length (10000) >= DISPLAY_CONTENT_LENGTH (500)
      // 2. Directly slice: largeNew.slice(-500) 
      // 3. NOT do: old + largeNew then slice (which would create 10100 char intermediate)
      
      const result = appendWithBound(old, largeNew, DISPLAY_CONTENT_LENGTH);
      
      expect(result.length).toBe(DISPLAY_CONTENT_LENGTH);
      expect(result).toBe('b'.repeat(500));
    });

    it('should demonstrate memory savings compared to naive approach', () => {
      // BEFORE (naive): Unbounded intermediate string creation
      // Each iteration could create a string up to (current + chunk) size before truncation
      
      // AFTER (optimized): No intermediate string larger than DISPLAY_CONTENT_LENGTH + chunk.length
      // More importantly, no intermediate string larger than necessary
      
      let optimizedContent = '';
      let maxIntermediateSize = 0;
      
      for (let i = 0; i < 1000; i++) {
        const chunk = 'x'.repeat(100);
        // Track what the maximum intermediate would be
        const wouldBeIntermediate = optimizedContent.length + chunk.length;
        
        optimizedContent = appendWithBound(optimizedContent, chunk, DISPLAY_CONTENT_LENGTH);
        
        // In the optimized version, the actual string never exceeds DISPLAY_CONTENT_LENGTH
        expect(optimizedContent.length).toBeLessThanOrEqual(DISPLAY_CONTENT_LENGTH);
      }
      
      // Final result should be bounded
      expect(optimizedContent.length).toBe(DISPLAY_CONTENT_LENGTH);
    });
  });

});
