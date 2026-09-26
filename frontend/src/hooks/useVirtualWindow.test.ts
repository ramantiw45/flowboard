import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeWindow } from './useVirtualWindow.ts';

const STRIDE = 100;
const VIEWPORT = 600;

test('a short list renders everything', () => {
  const w = computeWindow({ total: 5, stride: STRIDE, scrollTop: 0, viewportHeight: VIEWPORT });
  assert.equal(w.start, 0);
  assert.equal(w.end, 5);
  assert.equal(w.topSpacer, 0);
  assert.equal(w.bottomSpacer, 0);
});

test('an empty list renders nothing', () => {
  const w = computeWindow({ total: 0, stride: STRIDE, scrollTop: 0, viewportHeight: VIEWPORT });
  assert.equal(w.start, 0);
  assert.equal(w.end, 0);
});

test('a long list renders only a window at the top', () => {
  const w = computeWindow({ total: 100, stride: STRIDE, scrollTop: 0, viewportHeight: VIEWPORT });
  assert.ok(w.end < 100, 'must not render every card');
  assert.ok(w.end >= 7, 'must render enough to fill the viewport');
  assert.equal(w.start, 0);
  assert.equal(w.topSpacer, 0);
  assert.equal(w.bottomSpacer, (100 - w.end) * STRIDE);
});

test('scrolling moves the window and the spacers still cover the whole list', () => {
  const w = computeWindow({ total: 100, stride: STRIDE, scrollTop: 2000, viewportHeight: VIEWPORT });
  assert.ok(w.start > 0, 'should have scrolled past some cards');
  assert.ok(w.end <= 100);
  // Rendered slice plus both spacers must add up to the whole list, or the
  // scrollbar would shrink as the user scrolls.
  const covered = w.topSpacer + (w.end - w.start) * STRIDE + w.bottomSpacer;
  assert.equal(covered, 100 * STRIDE);
});

test('the end of the list is reachable and the last card is rendered', () => {
  const total = 100;
  const w = computeWindow({
    total,
    stride: STRIDE,
    scrollTop: (total - 1) * STRIDE,
    viewportHeight: VIEWPORT,
  });
  assert.equal(w.end, total, 'the last card must be inside the window');
  assert.equal(w.bottomSpacer, 0);
});

test('an unmeasured stride renders everything rather than dividing by zero', () => {
  // Before the first card renders there is no stride. Rendering all is the safe
  // answer; a NaN window would collapse the list to nothing.
  const w = computeWindow({ total: 50, stride: 0, scrollTop: 0, viewportHeight: VIEWPORT });
  assert.equal(w.start, 0);
  assert.equal(w.end, 50);
  assert.ok(Number.isFinite(w.bottomSpacer));
});

test('the window never runs past the end of the list', () => {
  for (const scrollTop of [0, 500, 5000, 99_999]) {
    const w = computeWindow({ total: 40, stride: STRIDE, scrollTop, viewportHeight: VIEWPORT });
    assert.ok(w.start >= 0, `start went negative at ${scrollTop}`);
    assert.ok(w.end <= 40, `end ran past the list at ${scrollTop}`);
    assert.ok(w.end >= w.start);
  }
});

test('a very tall viewport still renders at most the list', () => {
  const w = computeWindow({ total: 10, stride: STRIDE, scrollTop: 0, viewportHeight: 100_000 });
  assert.equal(w.end, 10);
});