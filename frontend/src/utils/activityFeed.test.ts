/**
 * Unit tests for the activity-feed buffer helpers.
 * Run with:  npm test   (node --test, no test framework required)
 *
 * The feed mixes three sources - the initial page, older pages fetched on
 * demand, and live WebSocket pushes - so the merge has to stay idempotent or
 * the same row renders twice and the buffer grows on every live event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_BUFFER_LIMIT,
  mergeOlderPage,
  prependActivity,
} from './activityFeed.ts';

const ev = (id, at = '2026-09-26T10:00:00Z') => ({
  id,
  actorId: 'u1',
  actorName: 'Alice',
  type: 'CARD_MOVED',
  cardId: null,
  message: `event ${id}`,
  at,
});

test('mergeOlderPage appends an older page below the existing rows', () => {
  const current = [ev('a'), ev('b')];
  const older = [ev('c'), ev('d')];
  assert.deepEqual(mergeOlderPage(current, older).map((e) => e.id), ['a', 'b', 'c', 'd']);
});

test('mergeOlderPage drops ids already present in the feed', () => {
  const current = [ev('a'), ev('b')];
  const older = [ev('b'), ev('c')];
  assert.deepEqual(mergeOlderPage(current, older).map((e) => e.id), ['a', 'b', 'c']);
});

test('mergeOlderPage returns the same array when the page adds nothing new', () => {
  const current = [ev('a')];
  assert.equal(mergeOlderPage(current, [ev('a')]), current);
  assert.equal(mergeOlderPage(current, []), current);
});

test('mergeOlderPage does not mutate its inputs', () => {
  const current = [ev('a')];
  const older = [ev('b')];
  mergeOlderPage(current, older);
  assert.deepEqual(current.map((e) => e.id), ['a']);
  assert.deepEqual(older.map((e) => e.id), ['b']);
});

test('prependActivity puts a live event at the head', () => {
  const current = [ev('a'), ev('b')];
  assert.deepEqual(prependActivity(current, ev('live')).map((e) => e.id), ['live', 'a', 'b']);
});

test('prependActivity replaces a row with the same id rather than duplicating it', () => {
  const current = [ev('a'), ev('b')];
  const after = prependActivity(current, { ...ev('a'), message: 'edited' });
  assert.deepEqual(after.map((e) => e.id), ['a', 'b']);
  assert.equal(after[0].message, 'edited');
});

test('prependActivity keeps the buffer bounded', () => {
  let feed = [];
  for (let i = 0; i < ACTIVITY_BUFFER_LIMIT + 25; i++) feed = prependActivity(feed, ev(`e${i}`));
  assert.equal(feed.length, ACTIVITY_BUFFER_LIMIT);
  assert.equal(feed[0].id, `e${ACTIVITY_BUFFER_LIMIT + 24}`);
});
