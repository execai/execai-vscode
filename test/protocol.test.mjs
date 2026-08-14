// Protocol parser: chunks arrive split at arbitrary offsets, "almost JSON" must
// wait for its tail, and garbage must not take the stream down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LineParser } from './.protocol.cjs';

test('a line cut into chunks reassembles into one event', () => {
  const p = new LineParser();
  // The split lands inside a multi-byte character on purpose: a naive buffer
  // would corrupt it.
  assert.deepEqual(p.push('{"type":"text_de'), []);
  assert.deepEqual(p.push('lta","text":"при'), []);
  const got = p.push('вет"}\n');
  assert.equal(got.length, 1);
  assert.equal(got[0].type, 'text_delta');
  assert.equal(got[0].text, 'привет');
});

test('several events in a single chunk', () => {
  const p = new LineParser();
  const got = p.push('{"type":"a"}\n{"type":"b"}\n{"type":"c"}\n');
  assert.deepEqual(got.map(e => e.type), ['a', 'b', 'c']);
});

test('garbage on the channel does not kill the parser and shows up as an error', () => {
  const p = new LineParser();
  const got = p.push('this is not json\n{"type":"ok"}\n');
  assert.equal(got.length, 2);
  assert.equal(got[0].type, 'error');
  assert.equal(got[1].type, 'ok');
});

test('empty lines are skipped', () => {
  const p = new LineParser();
  assert.deepEqual(p.push('\n\n{"type":"x"}\n\n'), [{ type: 'x' }]);
});
