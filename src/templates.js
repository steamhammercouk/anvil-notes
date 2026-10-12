// Summary templates: what Claude should focus on for each kind of recording,
// and the headings used for the two lists in the output.
const TEMPLATES = {
  auto: {
    label: 'Auto-detect',
    points: 'Key points',
    secondary: 'Decisions',
    instructions:
      'Work out what kind of recording this is (meeting, lecture, interview, call, voice note or something else) and summarise it in the way most useful for that kind. ' +
      'Points: the most important points. Secondary list: decisions that were agreed, if any.',
  },
  meeting: {
    label: 'Meeting',
    points: 'Key points',
    secondary: 'Decisions',
    instructions:
      'This is a meeting. Focus on what was discussed, what was decided and who agreed to do what. ' +
      'Points: the main discussion points and any open issues. Secondary list: decisions that were agreed. ' +
      'Tasks: action items, with owners and deadlines whenever they are stated.',
  },
  lecture: {
    label: 'Lecture or class',
    points: 'Key concepts',
    secondary: 'Questions to review',
    instructions:
      'This is a lecture, class or talk. Summarise it as study notes. ' +
      'Points: each key concept taught, with a one-sentence explanation. ' +
      'Secondary list: questions worth reviewing, including any the speaker left open. ' +
      'Tasks: assignments, readings, deadlines or follow-ups that were mentioned.',
  },
  interview: {
    label: 'Interview',
    points: 'Key insights',
    secondary: 'Notable quotes',
    instructions:
      'This is an interview. Summarise what was learned about the interviewee and the topics covered. ' +
      'Points: the key insights and facts that came out. ' +
      'Secondary list: short, exact quotes that capture important moments, in quotation marks, attributed to the speaker when identifiable. ' +
      'Tasks: follow-ups the interviewer or interviewee committed to.',
  },
  call: {
    label: 'Phone call',
    points: 'Key points',
    secondary: 'Agreements',
    instructions:
      'This is a phone or video call. Summarise the purpose and outcome of the call. ' +
      'Points: what was discussed. Secondary list: what was agreed, including prices, dates or terms. ' +
      'Tasks: follow-ups each side committed to.',
  },
  memo: {
    label: 'Voice memo',
    points: 'Ideas',
    secondary: 'Notes',
    instructions:
      'This is a personal voice note, so there is usually one speaker thinking aloud. Tidy their thoughts into clear notes, written in the first person. ' +
      'Points: the distinct ideas. Secondary list: supporting details and reminders worth keeping. ' +
      'Tasks: anything the speaker says they need or want to do.',
  },
};

function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.auto;
}

function templateOptions() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({ id, label: t.label }));
}

module.exports = { getTemplate, templateOptions };
