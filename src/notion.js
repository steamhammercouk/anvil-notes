// Creates a Notion page under a parent page from Markdown. Notion converts
// the Markdown natively (headings, bullets, `- [ ]` to-dos, toggles).
const { Client } = require('@notionhq/client');

const MAX_MARKDOWN_PER_REQUEST = 20000;

// Accepts a bare ID or a full Notion URL and returns the 32-char page ID.
function parsePageId(input) {
  const cleaned = String(input || '').split('?')[0].replace(/-/g, '');
  const match = cleaned.match(/[0-9a-f]{32}(?!.*[0-9a-f]{32})/i);
  if (!match) throw new Error('Set a valid Notion parent page (URL or ID) in Settings.');
  return match[0];
}

// Split Markdown into request-sized pieces on blank lines, never inside a
// <details> block, so each piece is valid Markdown on its own.
function splitMarkdown(markdown, max = MAX_MARKDOWN_PER_REQUEST) {
  const blocks = markdown.split(/\n{2,}/);
  const pieces = [];
  let current = '';
  let inDetails = false;
  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (current && next.length > max && !inDetails) {
      pieces.push(current);
      current = block;
    } else {
      current = next;
    }
    if (block.includes('<details>')) inDetails = true;
    if (block.includes('</details>')) inDetails = false;
  }
  if (current) pieces.push(current);
  return pieces;
}

// Notion expects the title as a property, so drop the leading "# Title" line.
function stripTitle(markdown) {
  return markdown.replace(/^# .*\n+/, '');
}

async function createMarkdownPage({ token, parentPageId, title, markdown }) {
  if (!token) throw new Error('Add your Notion integration token in Settings.');
  const notion = new Client({ auth: token });

  const [first, ...rest] = splitMarkdown(stripTitle(markdown));
  const page = await notion.pages.create({
    parent: { page_id: parsePageId(parentPageId) },
    properties: { title: { title: [{ type: 'text', text: { content: title.slice(0, 2000) } }] } },
    markdown: first,
  });

  for (const content of rest) {
    await notion.pages.updateMarkdown({
      page_id: page.id,
      type: 'insert_content',
      insert_content: { content, position: { type: 'end' } },
    });
  }

  return page.url;
}

module.exports = { createMarkdownPage, parsePageId, splitMarkdown };
