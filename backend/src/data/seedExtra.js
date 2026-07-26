'use strict';

/**
 * Extra seed content added on top of the original question bank.
 * ─────────────────────────────────────────────────────────────────
 * SABHA / SATSANG topic — a starter set of gentle, values-based
 * questions suitable for children's sabha.  These are intentionally
 * broad and non-denominational so they are safe defaults.  The mentor
 * is expected to REVIEW, EDIT, or REPLACE these from the dashboard to
 * match their own sabha's teachings, festivals, and stories.
 * ─────────────────────────────────────────────────────────────────
 */

const SABHA_TOPIC = { name: 'Sabha', emoji: '🙏', color: '#F59E0B' };

const SABHA_QUESTIONS = [
  { id:'sab1', topic:'Sabha', diff:'easy', pts:100,
    q:'What do we usually do together at the start of a sabha?',
    opts:['Pray','Fight','Sleep','Run'], ans:[0],
    exp:'A sabha usually begins with a prayer together, to calm the mind and begin with gratitude.' },

  { id:'sab2', topic:'Sabha', diff:'easy', pts:100,
    q:'How should we speak when someone else is talking in sabha?',
    opts:['Shout over them','Listen quietly','Laugh loudly','Leave the room'], ans:[1],
    exp:'Listening quietly is a sign of respect and helps everyone learn.' },

  { id:'sab3', topic:'Sabha', diff:'easy', pts:100,
    q:'Which of these is a good habit to practise every day?',
    opts:['Telling lies','Being kind','Being greedy','Being lazy'], ans:[1],
    exp:'Kindness is one of the most important values we learn and practise.' },

  { id:'sab4', topic:'Sabha', diff:'medium', pts:150,
    q:'What is the word for saying "thank you" to God for what we have?',
    opts:['Gratitude','Anger','Boredom','Jealousy'], ans:[0],
    exp:'Gratitude means being thankful. Being grateful makes us happier and humbler.' },

  { id:'sab5', topic:'Sabha', diff:'medium', pts:150,
    q:'If your friend makes a mistake and says sorry, what should you do?',
    opts:['Stay angry forever','Forgive them','Tell everyone','Ignore them'], ans:[1],
    exp:'Forgiveness helps friendships grow and keeps our own hearts light.' },

  { id:'sab6', topic:'Sabha', diff:'medium', pts:150,
    q:'What do we call helping others without expecting anything back?',
    opts:['Selfless service (seva)','A trade','A loan','A game'], ans:[0],
    exp:'Seva means selfless service — helping others simply because it is the right thing to do.' },

  { id:'sab7', topic:'Sabha', diff:'medium', pts:150,
    q:'Before eating, many families take a moment to do what?',
    opts:['Complain','Say a short prayer of thanks','Watch TV','Argue'], ans:[1],
    exp:'A short prayer of thanks before eating reminds us to be grateful for our food.' },

  { id:'sab8', topic:'Sabha', diff:'hard', pts:200,
    q:'Which of these best describes "honesty"?',
    opts:['Always telling the truth','Keeping secrets to trick people','Copying answers','Breaking promises'], ans:[0],
    exp:'Honesty means always telling the truth, even when it is difficult.' },

  { id:'sab9', topic:'Sabha', diff:'hard', pts:200,
    q:'Why do we sit calmly and focus during prayer or meditation?',
    opts:['To feel peaceful and focused','To feel sleepy','To waste time','To show off'], ans:[0],
    exp:'Sitting calmly helps our mind become peaceful, focused, and ready to learn good things.' },

  { id:'sab10', topic:'Sabha', diff:'hard', pts:200,
    q:'A festival is a special day when a community comes together to do what?',
    opts:['Celebrate and remember good values','Feel sad','Stay alone','Do nothing'], ans:[0],
    exp:'Festivals bring a community together to celebrate and remember important values and stories.' },
];

module.exports = { SABHA_TOPIC, SABHA_QUESTIONS };
