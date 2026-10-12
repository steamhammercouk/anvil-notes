// Summarises a transcript with Claude and extracts action items as
// structured data, which markdown.js then renders.
const Anthropic = require('@anthropic-ai/sdk');
const { betaZodOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/zod');
const { z } = require('zod');
const { getTemplate } = require('./templates');

const SummarySchema = z.object({
  title: z.string().describe('Short, specific title for the recording (max ~8 words)'),
  summary: z.string().describe('2-4 paragraph summary, separated by blank lines'),
  points: z.array(z.string()).describe('The main list described in the instructions, one item each'),
  secondary: z.array(z.string()).describe('The secondary list described in the instructions; empty if nothing fits'),
  tasks: z
    .array(
      z.object({
        task: z.string().describe('The action to take, starting with a verb'),
        owner: z.string().nullable().describe('Who is responsible, if stated'),
        due: z.string().nullable().describe('Deadline as said in the recording, if stated'),
      })
    )
    .describe('Every action item, commitment or follow-up someone needs to do; empty if none'),
});

const SYSTEM_PROMPT = `You summarise transcripts of audio recordings (meetings, calls, voice notes, lectures) for someone who wasn't there.

Each request includes instructions for the kind of recording, saying what belongs in the "points" and "secondary" lists. Write the summary in clear prose that captures what was discussed and why it matters. List items should be specific; prefer names, numbers and concrete details over generalities.

For tasks, include anything a person committed to, was asked to do, or that clearly needs follow-up, including tasks the speaker sets for themselves in a voice note. Don't invent tasks that aren't supported by the transcript. Only fill in owner and due when the transcript states them.

The transcript was produced by speech recognition, so expect some misheard words; infer the intended meaning where it's obvious. Write in the same language as the transcript.`;

async function summarize(transcript, settings, templateId) {
  const template = getTemplate(templateId);
  if (!settings.anthropicApiKey) throw new Error('Add your Claude API key in Settings to use summaries.');
  if (!transcript.trim()) throw new Error('The transcript is empty, so there is nothing to summarise.');

  const client = new Anthropic({ apiKey: settings.anthropicApiKey });

  let message;
  try {
    message = await client.beta.messages
      .stream({
        model: settings.claudeModel || 'claude-opus-5-5',
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(SummarySchema) },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `<instructions>\n${template.instructions}\n</instructions>\n\n<transcript>\n${transcript}\n</transcript>`,
          },
        ],
      })
      .finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Claude rejected the API key. Check it in Settings.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Claude rate limit reached. Wait a moment and try again.');
    if (err instanceof Anthropic.APIError) throw new Error(`Claude API error (${err.status ?? 'network'}): ${err.message}`);
    throw err;
  }

  if (message.stop_reason === 'refusal') throw new Error('Claude declined to summarise this recording.');
  if (message.stop_reason === 'max_tokens') throw new Error('The summary was cut off. Try again, or use the full transcript.');
  if (!message.parsed_output) throw new Error('Claude returned a summary in an unexpected format. Try again.');
  return message.parsed_output;
}

module.exports = { summarize };
