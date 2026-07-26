'use strict';

/**
 * QuizQuest Question Bank
 * ─────────────────────────────────────────────────────────────────
 * Total: 70 questions  (10 per topic × 7 topics)
 * Each topic breakdown:  3 Easy (100pts) | 4 Medium (150pts) | 3 Hard (200pts)
 * Topics: Math | Science | History | Geography | Computer | English | General
 * ─────────────────────────────────────────────────────────────────
 */

const QUESTIONS = [

  // ── 📐 MATH (5 questions: 2 easy · 2 medium · 1 hard) ──────────────────
  { id:'m1',  topic:'Math', diff:'easy',   pts:100,
    q: 'What is 7 × 8?',
    opts: ['54','56','48','64'], ans:[1],
    exp: '7 × 8 = 56. Quick trick: 7 × 4 = 28, then × 2 = 56.' },
  { id:'m2',  topic:'Math', diff:'easy',   pts:100,
    q: 'What is √144?',
    opts: ['10','11','12','13'], ans:[2],
    exp: '12 × 12 = 144, so √144 = 12.' },
  { id:'m4',  topic:'Math', diff:'medium', pts:150,
    q: 'A triangle has angles 60° and 70°. What is the third angle?',
    opts: ['40°','50°','60°','70°'], ans:[1],
    exp: 'Angles in a triangle sum to 180°. So 180 − 60 − 70 = 50°.' },
  { id:'m5',  topic:'Math', diff:'medium', pts:150,
    q: 'What is 15% of 200?',
    opts: ['25','30','35','40'], ans:[1],
    exp: '15% of 200 = 0.15 × 200 = 30.' },
  { id:'m8',  topic:'Math', diff:'hard',   pts:200,
    q: 'Solve for x:  2x + 10 = 30',
    opts: ['8','10','12','15'], ans:[1],
    exp: 'Subtract 10: 2x = 20. Divide by 2: x = 10.' },

  // ── 🔬 SCIENCE (5 questions: 2 easy · 2 medium · 1 hard) ───────────────
  { id:'s1',  topic:'Science', diff:'easy',   pts:100,
    q: 'Which planet is closest to the Sun?',
    opts: ['Venus','Mars','Mercury','Earth'], ans:[2],
    exp: 'Mercury is closest to the Sun, orbiting it every 88 days!' },
  { id:'s2',  topic:'Science', diff:'easy',   pts:100,
    q: 'What gas do plants absorb during photosynthesis?',
    opts: ['Oxygen','Carbon Dioxide','Nitrogen','Hydrogen'], ans:[1],
    exp: 'Plants absorb CO₂ and release Oxygen during photosynthesis.' },
  { id:'s4',  topic:'Science', diff:'medium', pts:150,
    q: 'What is the chemical symbol for Gold?',
    opts: ['Go','Gd','Au','Ag'], ans:[2],
    exp: 'Au comes from "Aurum" — Latin for gold.' },
  { id:'s5',  topic:'Science', diff:'medium', pts:150,
    q: 'How many bones are in the adult human body?',
    opts: ['196','206','216','226'], ans:[1],
    exp: 'Adults have 206 bones. Babies start with ~270 that fuse over time!' },
  { id:'s8',  topic:'Science', diff:'hard',   pts:200,
    q: 'What is the powerhouse of the cell?',
    opts: ['Nucleus','Ribosome','Mitochondria','Golgi Apparatus'], ans:[2],
    exp: 'The mitochondria produces ATP energy via cellular respiration.' },

  // ── 🏛️ HISTORY (4 questions: 1 easy · 2 medium · 1 hard) ────────────────
  { id:'h1',  topic:'History', diff:'easy',   pts:100,
    q: 'Who was the first President of the United States?',
    opts: ['Abraham Lincoln','George Washington','Thomas Jefferson','John Adams'], ans:[1],
    exp: 'George Washington became the 1st US President in 1789.' },
  { id:'h4',  topic:'History', diff:'medium', pts:150,
    q: 'Which empire built the Roman Colosseum?',
    opts: ['Greek Empire','Ottoman Empire','Roman Empire','Byzantine Empire'], ans:[2],
    exp: 'The Roman Colosseum was built 70–80 AD under Emperor Vespasian.' },
  { id:'h7',  topic:'History', diff:'medium', pts:150,
    q: 'Which country was first to give women the right to vote?',
    opts: ['USA','UK','Australia','New Zealand'], ans:[3],
    exp: 'New Zealand was first, granting women the vote in 1893.' },
  { id:'h8',  topic:'History', diff:'hard',   pts:200,
    q: 'In which year did the French Revolution begin?',
    opts: ['1776','1789','1799','1815'], ans:[1],
    exp: 'The French Revolution began in 1789 with the storming of the Bastille.' },

  // ── 🌍 GEOGRAPHY (4 questions: 2 easy · 1 medium · 1 hard) ─────────────
  { id:'g1',  topic:'Geography', diff:'easy',   pts:100,
    q: 'What is the capital city of France?',
    opts: ['London','Berlin','Rome','Paris'], ans:[3],
    exp: 'Paris has been the capital of France since 987 AD!' },
  { id:'g3',  topic:'Geography', diff:'easy',   pts:100,
    q: 'Which is the longest river in the world?',
    opts: ['Amazon','Nile','Yangtze','Mississippi'], ans:[1],
    exp: 'The Nile River in Africa is approximately 6,650 km long.' },
  { id:'g4',  topic:'Geography', diff:'medium', pts:150,
    q: 'What is the capital of Australia?',
    opts: ['Sydney','Melbourne','Canberra','Brisbane'], ans:[2],
    exp: 'Canberra (not Sydney!) is Australia capital, built in 1913.' },
  { id:'g8',  topic:'Geography', diff:'hard',   pts:200,
    q: 'What is the smallest country in the world by area?',
    opts: ['Monaco','Maldives','Vatican City','San Marino'], ans:[2],
    exp: 'Vatican City is just 0.44 km², located inside Rome, Italy.' },

  // ── 💻 COMPUTER (5 questions: 2 easy · 2 medium · 1 hard) ──────────────
  { id:'c1',  topic:'Computer', diff:'easy',   pts:100,
    q: 'What does CPU stand for?',
    opts: ['Central Process Unit','Central Processing Unit','Computer Processing Unit','Core Processing Unit'], ans:[1],
    exp: 'CPU = Central Processing Unit — the "brain" of a computer.' },
  { id:'c2',  topic:'Computer', diff:'easy',   pts:100,
    q: 'What does HTML stand for?',
    opts: ['Hyper Text Markup Language','High Tech Modern Language','Home Tool Markup Language','Hyper Transfer Markup Language'], ans:[0],
    exp: 'HTML = HyperText Markup Language — the language for web pages.' },
  { id:'c4',  topic:'Computer', diff:'medium', pts:150,
    q: 'What does RAM stand for?',
    opts: ['Random Access Memory','Read Access Memory','Random App Memory','Rapid Access Mode'], ans:[0],
    exp: 'RAM = Random Access Memory — fast, temporary storage for running programs.' },
  { id:'c6',  topic:'Computer', diff:'medium', pts:150,
    q: 'What does "URL" stand for?',
    opts: ['Uniform Resource Locator','Universal Resource Link','Unique Reference Locator','Uniform Routing Language'], ans:[0],
    exp: 'URL = Uniform Resource Locator — the web address for a resource online.' },
  { id:'c8',  topic:'Computer', diff:'hard',   pts:200,
    q: 'What is the binary representation of decimal 10?',
    opts: ['1010','1100','1001','1110'], ans:[0],
    exp: '10 in binary = 1010. Because 8+2=10: positions 8(1)+4(0)+2(1)+1(0).' },

  // ── 📖 ENGLISH (4 questions: 1 easy · 2 medium · 1 hard) ───────────────
  { id:'e1',  topic:'English', diff:'easy',   pts:100,
    q: 'What is a synonym for the word "Happy"?',
    opts: ['Sad','Joyful','Angry','Tired'], ans:[1],
    exp: '"Joyful" means full of happiness — a perfect synonym for happy!' },
  { id:'e4',  topic:'English', diff:'medium', pts:150,
    q: 'What is the plural of the word "Ox"?',
    opts: ['Oxes','Oxen','Ox','Oxies'], ans:[1],
    exp: '"Oxen" is the irregular plural of "ox".' },
  { id:'e7',  topic:'English', diff:'medium', pts:150,
    q: 'What does the prefix "un-" mean in the word "unhappy"?',
    opts: ['More','Very','Not','Before'], ans:[2],
    exp: 'The prefix "un-" means "not". So unhappy = not happy.' },
  { id:'e8',  topic:'English', diff:'hard',   pts:200,
    q: 'What literary device is used in "The stars danced in the sky"?',
    opts: ['Simile','Metaphor','Personification','Alliteration'], ans:[2],
    exp: 'Personification gives human traits (dancing) to non-human things (stars).' },

  // ── 🌟 GENERAL (3 questions: 1 easy · 1 medium · 1 hard) ───────────────
  { id:'gen1', topic:'General', diff:'easy',   pts:100,
    q: 'How many colors are in a rainbow?',
    opts: ['5','6','7','8'], ans:[2],
    exp: 'ROY G BIV — Red, Orange, Yellow, Green, Blue, Indigo, Violet = 7 colors!' },
  { id:'gen5', topic:'General', diff:'medium', pts:150,
    q: 'How many planets are in our solar system?',
    opts: ['7','8','9','10'], ans:[1],
    exp: '8 planets — Pluto was reclassified as a dwarf planet in 2006!' },
  { id:'gen10', topic:'General', diff:'hard',  pts:200,
    q: 'What is the process by which caterpillars transform into butterflies?',
    opts: ['Mitosis','Hibernation','Metamorphosis','Germination'], ans:[2],
    exp: 'Metamorphosis is the biological transformation from larva to adult butterfly.' },

];


// ─────────────────────────────────────────────────────────────────
// TOPIC DEFINITIONS
// ─────────────────────────────────────────────────────────────────
const TOPICS = [
  { name:'Math',      emoji:'📐', color:'#4F8CFF' },
  { name:'Science',   emoji:'🔬', color:'#7B61FF' },
  { name:'History',   emoji:'🏛️',  color:'#FF8C42' },
  { name:'Geography', emoji:'🌍', color:'#00D4AA' },
  { name:'Computer',  emoji:'💻', color:'#FFD93D' },
  { name:'English',   emoji:'📖', color:'#FF6B9D' },
  { name:'General',   emoji:'🌟', color:'#FF5252' },
];


// ─────────────────────────────────────────────────────────────────
// TEAM PRESETS
// ─────────────────────────────────────────────────────────────────
const TEAM_PRESETS = [
  { id:'A', name:'Team Alpha',   color:'#4F8CFF', emoji:'🔵' },
  { id:'B', name:'Team Bravo',   color:'#FF5252', emoji:'🔴' },
  { id:'C', name:'Team Charlie', color:'#4CAF50', emoji:'🟢' },
  { id:'D', name:'Team Delta',   color:'#FFD93D', emoji:'🟡' },
  { id:'E', name:'Team Echo',    color:'#FF6B9D', emoji:'🩷' },
  { id:'F', name:'Team Foxtrot', color:'#00D4AA', emoji:'🩵' },
];


module.exports = { QUESTIONS, TOPICS, TEAM_PRESETS };
