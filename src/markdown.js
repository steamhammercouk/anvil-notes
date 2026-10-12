// Builds Markdown that reads well as a file and imports cleanly into Notion:
// headings, bullets, `- [ ]` to-dos and a collapsible toggle for the transcript.

const { getTemplate } = require('./templates');

const MAX_PARAGRAPH = 1800; // stay under Notion's 2000-char rich text limit
const MAX_COLLAPSED_TRANSCRIPT = 15000; // keeps the toggle inside one Notion request

// Split long text into chunks no longer than `max`, preferring sentence
// and word boundaries.
function chunk(text, max = MAX_PARAGRAPH) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    else cut += 1;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Whisper often returns one long line; break it into readable paragraphs.
function toParagraphs(text, sentencesPerParagraph = 5) {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      const sentences = p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [p];
      const grouped = [];
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        grouped.push(sentences.slice(i, i + sentencesPerParagraph).join('').trim());
      }
      return grouped.flatMap((g) => chunk(g));
    });
}

// Escape characters that would otherwise turn transcript text into Markdown syntax.
function escapeInline(text) {
  return String(text).replace(/([\\`*_[\]<>~])/g, '\\$1');
}

function escapeParagraph(text) {
  return escapeInline(text).replace(/^(\s*)([-+#]|\d+\.)(\s)/, '$1\\$2$3');
}

function sourceLine({ fileName, date }) {
  return `*Source: ${escapeInline(fileName)} · Recorded ${date}*`;
}

function transcriptMarkdown({ title, text, fileName, date }) {
  return [
    `# ${escapeInline(title)}`,
    sourceLine({ fileName, date }),
    '## Transcript',
    ...toParagraphs(text).map(escapeParagraph),
  ].join('\n\n') + '\n';
}

function taskLine({ task, owner, due }) {
  const meta = [owner && `**${escapeInline(owner)}**`, due && `due ${escapeInline(due)}`].filter(Boolean);
  return `- [ ] ${escapeInline(task)}${meta.length ? ` (${meta.join(', ')})` : ''}`;
}

function summaryMarkdown({ title, summary, text, fileName, date, includeTranscript = true, templateId }) {
  const template = getTemplate(templateId);
  const sections = [`# ${escapeInline(title)}`, sourceLine({ fileName, date })];

  sections.push('## Summary', ...toParagraphs(summary.summary, 99).map(escapeParagraph));

  if (summary.tasks.length) {
    sections.push('## Tasks', summary.tasks.map(taskLine).join('\n'));
  }
  if (summary.points.length) {
    sections.push(`## ${template.points}`, summary.points.map((p) => `- ${escapeInline(p)}`).join('\n'));
  }
  if (summary.secondary.length) {
    sections.push(`## ${template.secondary}`, summary.secondary.map((d) => `- ${escapeInline(d)}`).join('\n'));
  }
  if (includeTranscript && text) {
    const body = toParagraphs(text).map(escapeParagraph).join('\n\n');
    // Notion renders <details> as a toggle block. A toggle has to be uploaded in
    // one request, so long transcripts go in a normal section instead.
    sections.push(
      body.length <= MAX_COLLAPSED_TRANSCRIPT
        ? `<details>\n<summary>Full transcript</summary>\n\n${body}\n\n</details>`
        : `## Full transcript\n\n${body}`
    );
  }

  return sections.join('\n\n') + '\n';
}

module.exports = { transcriptMarkdown, summaryMarkdown, toParagraphs, chunk };
