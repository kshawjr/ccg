import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '../lib/pdf';
import type { Analysis } from '../lib/analysis';
import type { Scores } from '../lib/types';

// Numbers chosen to exercise the previously-cropped multi-digit case
// (12, 21, 13, 14 — exactly the values from the user's bug report).
const scores: Scores = { orange: 12, blue: 21, gold: 13, green: 14 };

const analysis: Analysis = {
  snapshot:
    'Sample candidate Blue leads strongly (21), with a balanced Green/Gold backbone and a modest Orange. Reads as a relational operator who builds trust before chasing growth — likely strong on customer rapport and team culture, less natural at urgent in-the-field execution.',
  strengths: [
    {
      title: 'Customer empathy',
      detail:
        'A 21 Blue tells us Sample reads people well and will invest in long-term relationships with facilities clients.',
    },
    {
      title: 'Steady follow-through',
      detail:
        'Gold (13) and Green (14) together suggest reliable systems thinking — Sample will document processes and stick to them.',
    },
    {
      title: 'Coachable',
      detail:
        'The modest Orange (12) and high Blue means Sample is unlikely to ignore feedback, and will earnestly act on coaching from CCG.',
    },
  ],
  concerns: [
    {
      title: 'Bias for action',
      detail:
        'Orange of 12 is on the lower end — watch for hesitation in fast-moving moments where the right move is to commit and adapt.',
    },
    {
      title: 'Conflict avoidance',
      detail:
        'High Blue can soften hard conversations with underperforming team members. Probe how Sample has handled an employee firing or escalation.',
    },
    {
      title: 'Analytical loops',
      detail:
        'Green at 14 with Blue dominance can stall on imperfect data — confirm a track record of shipping decisions before all the inputs are in.',
    },
  ],
  coreValuesFit: [
    {
      value: 'Respond with Urgency',
      rating: 'Watch',
      note: 'Low Orange means urgency may not be instinctive; will lean on systems to compensate.',
    },
    {
      value: 'Exceed Expectations',
      rating: 'High',
      note: 'High Blue customer focus will naturally drive above-and-beyond service moments.',
    },
    {
      value: 'Integrity, Honesty, and Trust',
      rating: 'High',
      note: 'Authenticity is a Blue core trait — Sample will model honest dealings with clients and crew.',
    },
    {
      value: 'Everyone & Everything Matters',
      rating: 'High',
      note: 'High Blue + moderate Gold = a leader who notices the small things on each account.',
    },
    {
      value: 'Evolve & Adapt',
      rating: 'Medium',
      note: 'Green of 14 provides curiosity, but Orange of 12 may slow live pivots.',
    },
    {
      value: 'Do What You Say You Are Going to Do',
      rating: 'High',
      note: 'Gold + Blue combination is wired for follow-through and not letting people down.',
    },
  ],
  interviewQuestions: [
    'Walk me through a time you fired an underperforming employee — what triggered the call and how fast did you act?',
    'Describe a situation where you had to make a major operational decision with incomplete information. What did you do?',
    'Tell me about a B2B client relationship you built from cold to ongoing — what was your specific play?',
    'What does urgency mean to you on a Friday at 4pm when a key client emails about a service miss?',
    "How would you and your spouse divide responsibilities running a CCG franchise day-to-day?",
  ],
  recommendation: {
    verdict: 'Promising — Probe Further',
    summary:
      "Sample is a strong relational fit for CCG and will protect culture, but the Orange gap means we need to test urgency and execution speed live in the interview. Worth a deeper conversation before yes/no — bring the spouse if possible to gauge the partnership dynamic.",
  },
};

(async () => {
  const buffer = await renderToBuffer({
    name: 'Sample Candidate',
    scores,
    analysis,
  });
  const outPath = 'scratch/test-report.pdf';
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
