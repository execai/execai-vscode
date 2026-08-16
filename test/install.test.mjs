// CLI version comparison: it decides whether we offer an update. A bug here
// means either a permanent "please update" on a fresh binary, or silently
// running against an old one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionAtLeast, dottedNewer } from './.install.cjs';

test('dottedNewer: строго новее, мусор — false', () => {
  assert.equal(dottedNewer('0.2.10', '0.2.9'), true);
  assert.equal(dottedNewer('1.0.0', '0.9.9'), true);
  assert.equal(dottedNewer('v0.2.0', '0.1.9'), true); // тег с префиксом v
  assert.equal(dottedNewer('0.2', '0.2.0'), false);   // равные — не новее
  assert.equal(dottedNewer('0.2.9', '0.2.10'), false);
  assert.equal(dottedNewer('garbage', '0.1.0'), false);
  assert.equal(dottedNewer(null, '0.1.0'), false);
});

test('a higher major beats a lower minor', () => {
  assert.equal(versionAtLeast('R7.1', 'R6.33'), true);
  assert.equal(versionAtLeast('R6.34', 'R6.33'), true);
  assert.equal(versionAtLeast('R6.33', 'R6.33'), true);
  assert.equal(versionAtLeast('R6.32', 'R6.33'), false);
  assert.equal(versionAtLeast('R5.160', 'R6.33'), false);
});

test('the minor is compared as a number, not as a string', () => {
  // As strings "R6.9" > "R6.33"; as numbers it is smaller. The classic trap.
  assert.equal(versionAtLeast('R6.9', 'R6.33'), false);
  assert.equal(versionAtLeast('R6.100', 'R6.33'), true);
});

test('garbage and a missing version are never "new enough"', () => {
  for (const v of [null, '', 'dev', 'execai', 'v6.33']) {
    assert.equal(versionAtLeast(v, 'R6.33'), false, String(v));
  }
});
