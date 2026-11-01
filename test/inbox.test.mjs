// Parsing of the inbox additions to the ide protocol (tasks from the site).
//
// The agent side is written against the same contract in parallel, so the
// parsers accept every shape the contract allows and must stay quiet — return
// null — on an old agent that sends none of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LineParser, parseInbox, parseWorkspaces, askResolvedId, askResolvedBy, isWeb, firstWords, INBOX_STATES,
  PAYMENT_URL, displayUrl,
} from './.protocol.cjs';

const ev = (line) => {
  const got = new LineParser().push(line + '\n');
  assert.equal(got.length, 1);
  return got[0];
};

test('inbox event: all six states are recognized', () => {
  assert.deepEqual([...INBOX_STATES].sort(),
    ['disabled', 'listening', 'no_plan', 'not_logged_in', 'other_ide', 'other_serve']);
  for (const s of INBOX_STATES) {
    const info = parseInbox(ev(JSON.stringify({ type: 'inbox', state: s })));
    assert.equal(info.state, s);
    assert.equal(info.bound_workspace, null, 'no bound_workspace on the wire means not bound');
  }
});

test('inbox event: owner and bound project are carried through', () => {
  const info = parseInbox(ev(
    '{"type":"inbox","state":"other_ide","owner_pid":4242,"owner_cwd":"/home/u/proj",' +
    '"bound_workspace":{"id":"ws-1","name":"Shop"}}'));
  assert.deepEqual(info, {
    state: 'other_ide', owner_pid: 4242, owner_cwd: '/home/u/proj',
    bound_workspace: { id: 'ws-1', name: 'Shop' },
  });
});

test('inbox inside state: as an object and as a bare string', () => {
  const a = parseInbox(ev(
    '{"type":"state","model":"m","inbox":{"state":"listening","bound_workspace":{"id":"w","name":"W"}}}'));
  assert.equal(a.state, 'listening');
  assert.deepEqual(a.bound_workspace, { id: 'w', name: 'W' });

  const b = parseInbox(ev(
    '{"type":"state","inbox":"other_serve","owner_pid":77,"bound_workspace":{"id":"w2","name":"W2"}}'));
  assert.equal(b.state, 'other_serve');
  assert.equal(b.owner_pid, 77);
  assert.deepEqual(b.bound_workspace, { id: 'w2', name: 'W2' });
});

test('old agent: no inbox anywhere → null, nothing is shown', () => {
  assert.equal(parseInbox(ev('{"type":"state","model":"m","source":"execai"}')), null);
  assert.equal(parseInbox(ev('{"type":"ready","version":"R6.91","protocol":1}')), null);
  assert.equal(parseInbox(ev('{"type":"chats","chats":[]}')), null);
});

test('unknown or missing inbox state is ignored, not guessed', () => {
  assert.equal(parseInbox(ev('{"type":"inbox","state":"teleporting"}')), null);
  assert.equal(parseInbox(ev('{"type":"inbox"}')), null);
  assert.equal(parseInbox(ev('{"type":"state","inbox":42}')), null);
});

test('bound project: label/title/workspace_id are tolerated, junk is dropped', () => {
  assert.deepEqual(parseInbox(ev('{"type":"inbox","state":"listening","bound_workspace":{"workspace_id":"x","label":"X"}}')).bound_workspace,
    { id: 'x', name: 'X' });
  assert.deepEqual(parseInbox(ev('{"type":"inbox","state":"listening","bound_workspace":{"id":"y"}}')).bound_workspace,
    { id: 'y', name: 'y' }, 'a project without a name shows its id');
  assert.equal(parseInbox(ev('{"type":"inbox","state":"listening","bound_workspace":{}}')).bound_workspace, null);
  assert.equal(parseInbox(ev('{"type":"inbox","state":"listening","bound_workspace":null}')).bound_workspace, null);
  const odd = parseInbox(ev('{"type":"inbox","state":"other_serve","owner_pid":"oops"}'));
  assert.equal(odd.owner_pid, undefined);
});

test('workspaces: a dedicated event and a list inside state', () => {
  assert.deepEqual(parseWorkspaces(ev('{"type":"workspaces","items":[{"id":"a","name":"A"},{"id":"b","name":"B"}]}')),
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  assert.deepEqual(parseWorkspaces(ev('{"type":"workspaces","workspaces":[{"id":"a","name":"A"}]}')),
    [{ id: 'a', name: 'A' }]);
  assert.deepEqual(parseWorkspaces(ev('{"type":"state","workspaces":[{"id":"c","name":"C"},{"name":"no id"}]}')),
    [{ id: 'c', name: 'C' }], 'an entry without an id cannot be bound and is skipped');
  assert.deepEqual(parseWorkspaces(ev('{"type":"workspaces","items":[]}')), [],
    'an empty list is an answer: the account has no projects');
  assert.equal(parseWorkspaces(ev('{"type":"state","model":"m"}')), null, 'no list — no answer');
  assert.equal(parseWorkspaces(ev('{"type":"chats","items":[{"id":"a"}]}')), null);
});

test('ask_resolved names the question by ask_id (id as a fallback)', () => {
  const e = ev('{"type":"ask_resolved","chat":"c1","ask_id":"7"}');
  assert.equal(e.chat, 'c1');
  assert.equal(askResolvedId(e), '7');
  assert.equal(askResolvedId(ev('{"type":"ask_resolved","chat":"c1","id":"8"}')), '8');
  assert.equal(askResolvedId(ev('{"type":"ask_resolved"}')), '');
});

test('ask_resolved says who closed the question; unknown means withdrawn', () => {
  assert.equal(askResolvedBy(ev('{"type":"ask_resolved","chat":"c","ask_id":"1","by":"web"}')), 'web');
  assert.equal(askResolvedBy(ev('{"type":"ask_resolved","chat":"c","ask_id":"1","by":"panel"}')), 'panel');
  assert.equal(askResolvedBy(ev('{"type":"ask_resolved","chat":"c","ask_id":"1","by":"cancel"}')), 'cancel');
  assert.equal(askResolvedBy(ev('{"type":"ask_resolved","chat":"c","ask_id":"1"}')), 'cancel');
  assert.equal(askResolvedBy(ev('{"type":"ask_resolved","by":"martians"}')), 'cancel');
});

test('payment link: the gate page on chat.execai.ru, tagged; shown without the tags', () => {
  const u = new URL(PAYMENT_URL);
  assert.equal(u.host, 'chat.execai.ru');
  assert.equal(u.pathname, '/settings/payment');
  assert.equal(u.searchParams.get('utm_source'), 'agent');
  assert.equal(u.searchParams.get('utm_medium'), 'vscode');
  assert.equal(u.searchParams.get('utm_campaign'), 'inbox');
  assert.equal(displayUrl(PAYMENT_URL), 'chat.execai.ru/settings/payment');
});

test('origin=web on chats and on turn_start', () => {
  const chats = ev('{"type":"chats","chats":[{"id":"a","label":"x","origin":"web"},{"id":"b"}]}');
  assert.equal(isWeb(chats.chats[0]), true);
  assert.equal(isWeb(chats.chats[1]), false);
  assert.equal(isWeb(ev('{"type":"turn_start","chat":"a","origin":"web"}')), true);
  assert.equal(isWeb(ev('{"type":"turn_start","chat":"a"}')), false);
  assert.equal(isWeb(null), false);
});

test('firstWords: whole words, an ellipsis only when cut', () => {
  assert.equal(firstWords('fix the build'), 'fix the build');
  assert.equal(firstWords('  fix\n the   build  '), 'fix the build');
  assert.equal(firstWords('one two three four five six seven eight nine ten'),
    'one two three four five six seven eight…');
  assert.equal(firstWords('a'.repeat(100)), 'a'.repeat(60) + '…');
  assert.equal(firstWords('почини сборку и прогони все тесты в пакете billing, потом выложи на dev'),
    'почини сборку и прогони все тесты в пакете…');
  assert.equal(firstWords(''), '');
});
