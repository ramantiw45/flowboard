/**
 * Unit tests for the board-state reducers that drive drag-and-drop.
 * Run with:  npm test   (node --test, no test framework required)
 *
 * These cover the index arithmetic that decides where an optimistically moved
 * card lands, and the reconciliation of remote CARD_MOVED events.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveCardOptimistic, applyRemoteCardMove, sortCards } from './boardState.ts';

const card = (id, position, listId = 'L1') => ({
  id, listId, title: id, description: null, priority: 'MEDIUM', position, version: 0, createdAt: '',
});
const list = (id, cards) => ({ id, name: id, position: 0, version: 0, cards });
const titles = (lists, listId) => lists.find((l) => l.id === listId).cards.map((c) => c.id);

test('reorders a card within the same list', () => {
  const before = [list('L1', [card('a', 1000), card('b', 2000), card('c', 3000)])];
  const after = moveCardOptimistic(before, 'L1', 'L1', 0, 2);
  assert.deepEqual(titles(after, 'L1'), ['b', 'c', 'a']);
});

test('moves a card to another list', () => {
  const before = [list('L1', [card('a', 1000)]), list('L2', [card('b', 1000), card('c', 2000)])];
  const after = moveCardOptimistic(before, 'L1', 'L2', 0, 1);
  assert.deepEqual(titles(after, 'L1'), []);
  assert.deepEqual(titles(after, 'L2'), ['b', 'a', 'c']);
});

test('reassigns listId when a card crosses lists', () => {
  const before = [list('L1', [card('a', 1000)]), list('L2', [])];
  const after = moveCardOptimistic(before, 'L1', 'L2', 0, 0);
  assert.equal(after.find((l) => l.id === 'L2').cards[0].listId, 'L2');
});

test('does not mutate the input state', () => {
  const before = [list('L1', [card('a', 1000), card('b', 2000)])];
  const snapshot = JSON.stringify(before);
  moveCardOptimistic(before, 'L1', 'L1', 0, 1);
  assert.equal(JSON.stringify(before), snapshot);
});

test('is a no-op for an unknown source list', () => {
  const before = [list('L1', [card('a', 1000)])];
  assert.equal(moveCardOptimistic(before, 'nope', 'L1', 0, 0), before);
});

test('applyRemoteCardMove inserts at the fractional position it reports', () => {
  const before = [
    list('L1', [card('a', 1000), card('b', 2000), card('c', 3000)]),
    list('L2', []),
  ];
  // 1500 sits between a(1000) and b(2000) once the moved card is excluded.
  const ev = { cardId: 'c', fromListId: 'L1', toListId: 'L1', newPosition: 1500, actorId: 'u', version: 2 };
  const after = applyRemoteCardMove(before, ev);
  assert.deepEqual(titles(after, 'L1'), ['a', 'c', 'b']);
  assert.equal(after[0].cards[1].position, 1500);
  assert.equal(after[0].cards[1].version, 2);
});

test('applyRemoteCardMove applies a cross-list move', () => {
  const before = [list('L1', [card('a', 1000), card('b', 2000)]), list('L2', [card('c', 1000)])];
  const ev = { cardId: 'a', fromListId: 'L1', toListId: 'L2', newPosition: 500, actorId: 'u', version: 3 };
  const after = applyRemoteCardMove(before, ev);
  assert.deepEqual(titles(after, 'L1'), ['b']);
  assert.deepEqual(titles(after, 'L2'), ['a', 'c']);
  assert.equal(after[1].cards[0].listId, 'L2');
});

test('applyRemoteCardMove ignores an event for an unknown card', () => {
  const before = [list('L1', [card('a', 1000)])];
  const ev = { cardId: 'ghost', fromListId: 'L1', toListId: 'L1', newPosition: 500, actorId: 'u', version: 1 };
  assert.equal(applyRemoteCardMove(before, ev), before);
});

test('sortCards orders by position without mutating the input', () => {
  const input = [card('b', 2000), card('a', 1000)];
  const sorted = sortCards(input);
  assert.deepEqual(sorted.map((c) => c.id), ['a', 'b']);
  assert.deepEqual(input.map((c) => c.id), ['b', 'a']);
});
