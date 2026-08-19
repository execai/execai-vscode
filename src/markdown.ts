// Markdown for the chat panel.
//
// Why hand-written. The webview runs under a strict CSP with a script nonce and
// no external hosts, so a library would have to be inlined whole; and answers
// arrive token by token, so the renderer runs on every delta and has to stay
// cheap. What models actually produce is a small subset — tables, fenced code,
// lists, headings, emphasis, links — and that subset fits in one function.
//
// Why one self-contained function. Its source is inlined into the panel via
// `renderMarkdown.toString()`, so the panel and the tests share one
// implementation instead of drifting apart. That also means: no imports, no
// module-level helpers, no closures — nothing that would not survive being
// turned back into text.
//
// Security. Everything is escaped FIRST, and markup is produced only from the
// escaped text. The model's output is untrusted by construction: it can carry
// whatever it read on the web. Links are limited to http/https/mailto, so
// `javascript:` never reaches an href.

export function renderMarkdown(src: string): string {
  if (!src) return '';

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Inline pass: code first, so emphasis inside `a*b*c` stays literal.
  const inline = (s: string) => {
    const code: string[] = [];
    let t = s.replace(/`([^`\n]+)`/g, (_m, c) => {
      code.push(c);
      // Markers must survive the trip into the webview: the panel receives
      // this function as text inside an HTML document, and an HTML parser
      // drops U+0000. With a NUL marker the restore step found nothing and
      // "call `go test`" reached the screen as "call 0" — visible only in a
      // real editor, never in a unit test that calls the module directly.
      return '\uE000' + (code.length - 1) + '\uE001';
    });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      return /^(https?:|mailto:)/i.test(href)
        ? '<a href="' + href + '">' + label + '</a>'
        : m; // not a link we trust — leave it as plain text
    });
    // Bare URLs the model wrote as plain text. Only outside an existing <a…>,
    // which is why this runs after the markdown-link pass and skips anything
    // already wrapped: the negative lookbehind on quote/> is the cheap way to
    // tell "https://x" in prose from href="https://x" just produced above.
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<>"')\]]+)/g, (_m, pre, url) => {
      // Trailing punctuation belongs to the sentence, not to the link.
      const tail = (url.match(/[.,;:!?)\]]+$/) || [''])[0];
      const clean = url.slice(0, url.length - tail.length);
      return pre + '<a href="' + clean + '">' + clean + '</a>' + tail;
    });
    // Paths to project files: src/app.ts, internal/agent/memory.go:42.
    // Deliberately narrow — a slash or a line number is required, otherwise
    // every "package.json" mentioned in passing becomes a link and the answer
    // turns blue. The webview turns these into "open in the editor" clicks.
    t = t.replace(
      /(^|[\s(«"'`])((?:[\w.@-]+\/)+[\w.@-]+\.[a-z]{1,5}|[\w.@-]+\.[a-z]{1,5}(?=:\d))(:(\d+))?(?::(\d+))?/gi,
      (m, pre, path, _c, line) => {
        if (/^https?:/i.test(path) || path.indexOf('\uE000') >= 0) return m;
        const attr = ' data-file="' + path + '"' + (line ? ' data-line="' + line + '"' : '');
        const shown = path + (line ? ':' + line : '');
        return pre + '<a href="#"' + attr + '>' + shown + '</a>';
      },
    );
    t = t.replace(/(^|[^*])\*\*([^*\n]+)\*\*/g, '$1<strong>$2</strong>');
    t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return t.replace(/\uE000(\d+)\uE001/g, (_m, i) => '<code>' + code[Number(i)] + '</code>');
  };

  const lines = esc(src).split('\n');
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + inline(para.join('\n')) + '</p>');
      para = [];
    }
  };

  // A table header is recognised by the divider line under it: without that
  // check, ordinary text containing pipes would turn into a table.
  const isDivider = (s: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);
  const cells = (s: string) =>
    s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code: the body is NOT processed as markdown.
    const fence = /^\s*(```|~~~)(.*)$/.exec(line);
    if (fence) {
      flushPara();
      const mark = fence[1];
      const lang = fence[2].trim().replace(/[^\w+-]/g, '');
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s*' + mark).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      out.push('<pre class="code"' + (lang ? ' data-lang="' + lang + '"' : '') +
        '><code>' + body.join('\n') + '</code></pre>');
      continue;
    }

    // Table.
    if (line.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushPara();
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left');
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(cells(lines[i]));
        i++;
      }
      let html = '<div class="tablewrap"><table><thead><tr>';
      head.forEach((h, n) => {
        html += '<th style="text-align:' + (align[n] || 'left') + '">' + inline(h) + '</th>';
      });
      html += '</tr></thead><tbody>';
      for (const r of rows) {
        html += '<tr>';
        // Rows shorter than the header should not happen, but models send
        // them: pad the missing cells, otherwise the table falls apart.
        for (let n = 0; n < head.length; n++) {
          html += '<td style="text-align:' + (align[n] || 'left') + '">' +
            inline(r[n] === undefined ? '' : r[n]) + '</td>';
        }
        html += '</tr>';
      }
      out.push(html + '</tbody></table></div>');
      continue;
    }

    // Heading.
    const head = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      flushPara();
      const level = Math.min(head[1].length + 2, 6); // h1 is too loud in a side panel
      out.push('<h' + level + '>' + inline(head[2]) + '</h' + level + '>');
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushPara();
      out.push('<hr>');
      i++;
      continue;
    }

    // Block quote.
    if (/^\s*&gt;\s?/.test(line)) {
      flushPara();
      const body: string[] = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*&gt;\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + inline(body.join('\n')) + '</blockquote>');
      continue;
    }

    // Lists. Nesting is taken from the indent, two spaces per level.
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = /\d/.test(item[2]);
      let html = ordered ? '<ol>' : '<ul>';
      let depth = 0;
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        const d = Math.floor(m[1].length / 2);
        while (d > depth) { html += ordered ? '<ol>' : '<ul>'; depth++; }
        while (d < depth) { html += ordered ? '</ol>' : '</ul>'; depth--; }
        html += '<li>' + inline(m[3]) + '</li>';
        i++;
      }
      while (depth-- > 0) html += ordered ? '</ol>' : '</ul>';
      out.push(html + (ordered ? '</ol>' : '</ul>'));
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      i++;
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return out.join('');
}
