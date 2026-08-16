// Разметка в панели: таблицы, код, экранирование.
//
// Владелец прислал скриншот: таблицы приходили сырым текстом с вертикальными
// чертами — панель вставляла ответ как обычный текст. Здесь закреплено то,
// что модели реально присылают.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderMarkdown } = require('./.markdown.cjs');

test('таблица превращается в настоящую таблицу', () => {
  const html = renderMarkdown([
    '| этап | итог |',
    '|---|---:|',
    '| сборка | 15с |',
    '| тесты | 3с |',
  ].join('\n'));
  assert.match(html, /<table>/);
  assert.equal((html.match(/<tr>/g) || []).length, 3, 'заголовок и две строки');
  assert.match(html, /<th[^>]*>этап<\/th>/);
  assert.match(html, /<td[^>]*>15с<\/td>/);
  assert.match(html, /text-align:right/, 'выравнивание из :--- учтено');
  assert.ok(!html.includes('|'), 'сырых чертей в выводе остаться не должно');
});

test('строка короче заголовка не разъезжается', () => {
  const html = renderMarkdown('| a | b | c |\n|---|---|---|\n| 1 |\n');
  const cellsInRow = (html.match(/<td/g) || []).length;
  assert.equal(cellsInRow, 3, 'недостающие ячейки дорисованы пустыми');
});

test('текст с чертами БЕЗ разделителя таблицей не становится', () => {
  const html = renderMarkdown('вариант а | вариант б — выбирай');
  assert.ok(!html.includes('<table'), 'иначе обычный текст превращался бы в таблицу');
});

test('блок кода не трогается разметкой', () => {
  const html = renderMarkdown('```go\nif *p == "**x**" { }\n```');
  assert.match(html, /<pre class="code" data-lang="go">/);
  assert.ok(!html.includes('<strong>'), 'внутри кода разметка не применяется');
  assert.match(html, /if \*p == /);
});

test('html из ответа модели экранируется', () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)"> и <script>bad()</script>');
  assert.ok(!html.includes('<img'), 'тег не должен доехать до панели живым');
  assert.ok(!html.includes('<script'), 'тем более скрипт');
  assert.match(html, /&lt;img/);
});

test('ссылка только http/https, javascript: остаётся текстом', () => {
  const ok = renderMarkdown('[сайт](https://execai.ru)');
  assert.match(ok, /<a href="https:\/\/execai\.ru">сайт<\/a>/);
  const bad = renderMarkdown('[клик](javascript:alert(1))');
  assert.ok(!bad.includes('<a '), 'javascript: ссылкой не становится');
});

test('жирный, курсив, инлайн-код, заголовки и списки', () => {
  const html = renderMarkdown('## Итог\n\n**важно** и *курсив*, вызов `go test`\n\n- раз\n- два\n');
  assert.match(html, /<h4>Итог<\/h4>/);
  assert.match(html, /<strong>важно<\/strong>/);
  assert.match(html, /<em>курсив<\/em>/);
  assert.match(html, /<code>go test<\/code>/);
  assert.equal((html.match(/<li>/g) || []).length, 2);
});

test('пустой и обычный текст не ломаются', () => {
  assert.equal(renderMarkdown(''), '');
  assert.match(renderMarkdown('просто ответ'), /<p>просто ответ<\/p>/);
});

// Инлайн-код в конце строки и обычные числа в тексте.
//
// Подстановка кода делалась через « N » — индекс в пробелах. В конце строки
// закрывающего пробела нет, и маркер оставался на экране голой цифрой:
// «вызов `код`» превращалось в «вызов 0» (поймано живым прогоном). А число,
// написанное человеком через пробелы, наоборот становилось кодом.
test('код в конце строки не превращается в цифру', () => {
  const html = renderMarkdown('вызов `go test`');
  assert.match(html, /<code>go test<\/code>/);
  assert.ok(!/>\s*0\s*</.test(html), 'маркер подстановки не должен доехать до экрана');
});

test('обычное число в тексте остаётся числом', () => {
  const html = renderMarkdown('заняло 15 секунд, а не 0 секунд');
  assert.ok(!html.includes('<code>'), 'число между пробелами — не код');
  assert.match(html, /заняло 15 секунд/);
});

test('несколько вставок кода в одной строке', () => {
  const html = renderMarkdown('`a` и `b` и `c`');
  assert.equal((html.match(/<code>/g) || []).length, 3);
  assert.match(html, /<code>a<\/code> и <code>b<\/code> и <code>c<\/code>/);
});
