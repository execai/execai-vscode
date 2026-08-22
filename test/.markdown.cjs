"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/markdown.ts
var markdown_exports = {};
__export(markdown_exports, {
  renderMarkdown: () => renderMarkdown
});
module.exports = __toCommonJS(markdown_exports);
function renderMarkdown(src) {
  if (!src) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const inline = (s) => {
    const code = [];
    let t = s.replace(/`([^`\n]+)`/g, (_m, c) => {
      code.push(c);
      return "\uE000" + (code.length - 1) + "\uE001";
    });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      return /^(https?:|mailto:)/i.test(href) ? '<a href="' + href + '">' + label + "</a>" : m;
    });
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<>"')\]]+)/g, (_m, pre, url) => {
      const tail = (url.match(/[.,;:!?)\]]+$/) || [""])[0];
      const clean = url.slice(0, url.length - tail.length);
      return pre + '<a href="' + clean + '">' + clean + "</a>" + tail;
    });
    t = t.replace(
      /(^|[\s(«"'`])((?:[\w.@-]+\/)+[\w.@-]+\.[a-z]{1,5}|[\w.@-]+\.[a-z]{1,5}(?=:\d))(:(\d+))?(?::(\d+))?/gi,
      (m, pre, path, _c, line) => {
        if (/^https?:/i.test(path) || path.indexOf("\uE000") >= 0) return m;
        const attr = ' data-file="' + path + '"' + (line ? ' data-line="' + line + '"' : "");
        const shown = path + (line ? ":" + line : "");
        return pre + '<a href="#"' + attr + ">" + shown + "</a>";
      }
    );
    t = t.replace(/(^|[^*])\*\*([^*\n]+)\*\*/g, "$1<strong>$2</strong>");
    t = t.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
    t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    return t.replace(/\uE000(\d+)\uE001/g, (_m, i2) => "<code>" + code[Number(i2)] + "</code>");
  };
  const lines = esc(src).split("\n");
  const out = [];
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      out.push("<p>" + inline(para.join("\n")) + "</p>");
      para = [];
    }
  };
  const isDivider = (s) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);
  const cells = (s) => s.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^\s*(```|~~~)(.*)$/.exec(line);
    if (fence) {
      flushPara();
      const mark = fence[1];
      const lang = fence[2].trim().replace(/[^\w+-]/g, "");
      const body = [];
      i++;
      while (i < lines.length && !new RegExp("^\\s*" + mark).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push('<pre class="code"' + (lang ? ' data-lang="' + lang + '"' : "") + "><code>" + body.join("\n") + "</code></pre>");
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushPara();
      const head2 = cells(line);
      const align = cells(lines[i + 1]).map((c) => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left");
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(cells(lines[i]));
        i++;
      }
      let html = '<div class="tablewrap"><table><thead><tr>';
      head2.forEach((h, n) => {
        html += '<th style="text-align:' + (align[n] || "left") + '">' + inline(h) + "</th>";
      });
      html += "</tr></thead><tbody>";
      for (const r of rows) {
        html += "<tr>";
        for (let n = 0; n < head2.length; n++) {
          html += '<td style="text-align:' + (align[n] || "left") + '">' + inline(r[n] === void 0 ? "" : r[n]) + "</td>";
        }
        html += "</tr>";
      }
      out.push(html + "</tbody></table></div>");
      continue;
    }
    const head = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (head) {
      flushPara();
      const level = Math.min(head[1].length + 2, 6);
      out.push("<h" + level + ">" + inline(head[2]) + "</h" + level + ">");
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushPara();
      out.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*&gt;\s?/.test(line)) {
      flushPara();
      const body = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*&gt;\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + inline(body.join("\n")) + "</blockquote>");
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = /\d/.test(item[2]);
      let html = ordered ? "<ol>" : "<ul>";
      let depth = 0;
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        const d = Math.floor(m[1].length / 2);
        while (d > depth) {
          html += ordered ? "<ol>" : "<ul>";
          depth++;
        }
        while (d < depth) {
          html += ordered ? "</ol>" : "</ul>";
          depth--;
        }
        html += "<li>" + inline(m[3]) + "</li>";
        i++;
      }
      while (depth-- > 0) html += ordered ? "</ol>" : "</ul>";
      out.push(html + (ordered ? "</ol>" : "</ul>"));
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return out.join("");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  renderMarkdown
});
