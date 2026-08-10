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

  { id:'sab11', topic:'Sabha', diff:'easy', pts:100,
    q:'What does the word "Satsang" generally mean?',
    opts:['Good company / being in the company of truth','A type of festival','A musical instrument','A type of food'], ans:[0],
    exp:'"Sat" means truth/goodness, "sang" means company or association — so Satsang means keeping good, truthful company.' },

  { id:'sab12', topic:'Sabha', diff:'medium', pts:150,
    q:'What is the main purpose of attending a Sabha (spiritual gathering)?',
    opts:['Entertainment only','Learning values and growing spiritually','Shopping','Watching sports'], ans:[1],
    exp:'A Sabha is a gathering meant for learning good values and growing spiritually together.' },

  { id:'sab13', topic:'Sabha', diff:'medium', pts:150,
    q:'Which quality most helps build trust between people?',
    opts:['Lying','Honesty','Greed','Pride'], ans:[1],
    exp:'Honesty is what allows people to trust and rely on one another.' },

  { id:'sab14', topic:'Sabha', diff:'hard', pts:200,
    q:'"Seva" is a term commonly used in Indian spiritual traditions to mean:',
    opts:['Selfless service','Punishment','Competition','Wealth'], ans:[0],
    exp:'Seva means selfless service — helping others without expecting anything in return.' },

  { id:'sab15', topic:'Sabha', diff:'hard', pts:200,
    q:'Practising gratitude every day mainly helps a person to:',
    opts:['Feel more anxious','Appreciate what they have and stay positive','Become more selfish','Ignore others'], ans:[1],
    exp:'Gratitude helps us notice and appreciate the good things we already have, which builds a positive outlook.' },
];

// ── SCIENCE / HISTORY / GEOGRAPHY / COMPUTER / ENGLISH — extra questions ──
const MORE_QUESTIONS = [
  { id:'sci_x1', topic:'Science', diff:'easy', pts:100,
    q:'Which planet is known as the "Red Planet"?',
    opts:['Venus','Mars','Jupiter','Saturn'], ans:[1],
    exp:'Its reddish colour comes from iron oxide (rust) on its surface.' },
  { id:'sci_x2', topic:'Science', diff:'medium', pts:150,
    q:'Sound travels fastest through which of these?',
    opts:['Air','Water','Steel','Vacuum'], ans:[2],
    exp:"Sound travels faster through denser solids than through liquids or gases, and can't travel through a vacuum at all." },
  { id:'sci_x3', topic:'Science', diff:'hard', pts:200,
    q:"Newton's Second Law of Motion is usually written as:",
    opts:['Force = mass ÷ acceleration','Force = mass × acceleration','Force = mass + acceleration','Force = acceleration ÷ mass'], ans:[1],
    exp:'F = ma — force equals mass times acceleration.' },
  { id:'sci_x4', topic:'Science', diff:'hard', pts:200,
    q:'What is the SI unit of electrical resistance?',
    opts:['Ampere','Volt','Ohm','Watt'], ans:[2],
    exp:'Resistance is measured in ohms (Ω).' },

  { id:'hist_x1', topic:'History', diff:'medium', pts:150,
    q:'The Great Wall of China was mainly built to protect against:',
    opts:['Floods','Invasions','Earthquakes','Famine'], ans:[1],
    exp:'It was built to defend against raids and invasions from northern nomadic groups.' },
  { id:'hist_x2', topic:'History', diff:'medium', pts:150,
    q:'Who wrote India\'s national anthem, "Jana Gana Mana"?',
    opts:['Bankim Chandra Chattopadhyay','Rabindranath Tagore','Sarojini Naidu','Subhas Chandra Bose'], ans:[1],
    exp:'Rabindranath Tagore wrote and composed "Jana Gana Mana".' },
  { id:'hist_x3', topic:'History', diff:'hard', pts:200,
    q:'The "Quit India Movement" was launched in which year?',
    opts:['1920','1930','1942','1947'], ans:[2],
    exp:'The Quit India Movement, led by Gandhi, began in August 1942.' },
  { id:'hist_x4', topic:'History', diff:'hard', pts:200,
    q:'Which empire is famous for building the Colosseum?',
    opts:['Greek','Roman','Persian','Egyptian'], ans:[1],
    exp:'The Colosseum was built by the Romans in ancient Rome.' },

  { id:'geo_x1', topic:'Geography', diff:'easy', pts:100,
    q:'Which is the smallest country in the world by area?',
    opts:['Monaco','Vatican City','Nauru','San Marino'], ans:[1],
    exp:'Vatican City is the smallest country in the world by area.' },
  { id:'geo_x2', topic:'Geography', diff:'medium', pts:150,
    q:'Which is the largest hot desert in the world?',
    opts:['Thar','Sahara','Gobi','Kalahari'], ans:[1],
    exp:'The Sahara, in northern Africa, is the largest hot desert in the world.' },
  { id:'geo_x3', topic:'Geography', diff:'hard', pts:200,
    q:'Which strait separates Asia from North America?',
    opts:['Bering Strait','Strait of Gibraltar','Palk Strait','Strait of Malacca'], ans:[0],
    exp:'The Bering Strait separates the easternmost tip of Asia from Alaska in North America.' },

  { id:'comp_x1', topic:'Computer', diff:'medium', pts:150,
    q:'Who is credited as the creator of the Python programming language?',
    opts:['Guido van Rossum','James Gosling','Dennis Ritchie','Bjarne Stroustrup'], ans:[0],
    exp:'Guido van Rossum created Python and first released it in 1991.' },
  { id:'comp_x2', topic:'Computer', diff:'hard', pts:200,
    q:'What is the decimal value of the binary number 1010?',
    opts:['8','9','10','12'], ans:[2],
    exp:'1010 in binary = (1×8)+(0×4)+(1×2)+(0×1) = 10.' },
  { id:'comp_x3', topic:'Computer', diff:'hard', pts:200,
    q:'Which data structure follows the FIFO (First In, First Out) rule?',
    opts:['Stack','Queue','Tree','Graph'], ans:[1],
    exp:'A Queue serves items in the order they arrived — first in, first out.' },

  { id:'eng_x1', topic:'English', diff:'medium', pts:150,
    q:'Which of these is spelled correctly?',
    opts:['Recieve','Receive','Receeve','Receve'], ans:[1],
    exp:'Remember the rule: "i before e, except after c."' },
  { id:'eng_x2', topic:'English', diff:'hard', pts:200,
    q:'Which literary device compares two different things using "like" or "as"?',
    opts:['Metaphor','Simile','Personification','Alliteration'], ans:[1],
    exp:'A simile compares two things using "like" or "as" — e.g. "brave as a lion."' },
  { id:'eng_x3', topic:'English', diff:'hard', pts:200,
    q:'Which sentence is correctly punctuated?',
    opts:["Lets eat Grandma","Let's eat, Grandma","Lets, eat Grandma","Let's eat Grandma,"], ans:[1],
    exp:"The comma before a name being addressed matters — \"Let's eat, Grandma\" invites Grandma to eat, not the other way around!" },
];

// ── 🧠 LOGICAL REASONING — new topic ─────────────────────────────────────
// A tricky-but-fair mix meant to make an 8–24 year-old actually stop and
// *think* rather than just recall a fact — pattern spotting, careful reading,
// and process-of-elimination, ramping up from "aha, easy" to "wait, re-read
// that" as difficulty rises.
const LOGIC_TOPIC = { name: 'Logical Reasoning', emoji: '🧠', color: '#7B61FF' };

const LOGIC_QUESTIONS = [
  { id:'log1', topic:'Logical Reasoning', diff:'easy', pts:100,
    q:'Find the odd one out: Apple, Banana, Carrot, Mango',
    opts:['Apple','Banana','Carrot','Mango'], ans:[2],
    exp:'Carrot is a vegetable — the other three are all fruits.' },
  { id:'log2', topic:'Logical Reasoning', diff:'easy', pts:100,
    q:'If today is Monday, what day will it be after 3 more days?',
    opts:['Wednesday','Thursday','Friday','Saturday'], ans:[1],
    exp:'Monday + 3 days = Tuesday, Wednesday, Thursday.' },
  { id:'log3', topic:'Logical Reasoning', diff:'easy', pts:100,
    q:'A farmer has 10 sheep. All but 7 run away. How many sheep are left?',
    opts:['3','7','10','0'], ans:[1],
    exp:"\"All but 7\" means 7 stayed — the number that ran away is irrelevant. It's a classic trick-reading question!" },
  { id:'log4', topic:'Logical Reasoning', diff:'medium', pts:150,
    q:'Complete the number sequence: 2, 4, 8, 16, ?',
    opts:['18','24','32','20'], ans:[2],
    exp:'Each number is double the one before it: 16 × 2 = 32.' },
  { id:'log5', topic:'Logical Reasoning', diff:'medium', pts:150,
    q:'Riya sits to the left of Meera, and Meera sits to the left of Sara. Who is sitting in the middle?',
    opts:['Riya','Meera','Sara','Cannot be determined'], ans:[1],
    exp:'The order is Riya – Meera – Sara, so Meera is in the middle.' },
  { id:'log6', topic:'Logical Reasoning', diff:'medium', pts:150,
    q:'A man says, "The day before yesterday I was 25, and next year I will be 28." What day is his birthday?',
    opts:['Today','Tomorrow','December 31st (and today is Jan 1st)',"It's impossible"], ans:[2],
    exp:'This only works if today is January 1st and his birthday is December 31st — so he turned 26 two days ago (Dec 31), turns 27 this year, and 28 next year.' },
  { id:'log7', topic:'Logical Reasoning', diff:'hard', pts:200,
    q:'If CAT is coded as DBU (each letter shifted forward by 1), how would DOG be coded the same way?',
    opts:['EPH','EPI','FQH','EQH'], ans:[0],
    exp:'Shift each letter forward by one: D→E, O→P, G→H, giving EPH.' },
  { id:'log8', topic:'Logical Reasoning', diff:'hard', pts:200,
    q:'On a clock showing 3:15, what is the approximate angle between the hour and minute hands?',
    opts:['0°','7.5°','30°','15°'], ans:[1],
    exp:'At 3:15 the minute hand points exactly at "3", but the hour hand has moved a quarter of the way toward "4" — a 7.5° gap.' },
  { id:'log9', topic:'Logical Reasoning', diff:'hard', pts:200,
    q:'Five friends run a race with no ties. Aisha finishes before Ben. Ben finishes before Chloe. Dev finishes right after Chloe. Emma finishes first. What is the finishing order?',
    opts:['Emma, Aisha, Ben, Chloe, Dev','Aisha, Emma, Ben, Chloe, Dev','Emma, Ben, Aisha, Chloe, Dev','Aisha, Ben, Emma, Chloe, Dev'], ans:[0],
    exp:'Emma is first (given). Then, in order, Aisha before Ben before Chloe, with Dev right after Chloe: Emma, Aisha, Ben, Chloe, Dev.' },
  { id:'log10', topic:'Logical Reasoning', diff:'hard', pts:200,
    q:'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
    opts:['$0.10','$0.05','$1.00','$0.55'], ans:[1],
    exp:'If the ball costs $0.05, the bat costs $1.05 (which is $1.00 more), and together they total $1.10. ($0.10 is the tempting but wrong "gut" answer!)' },
];

module.exports = { SABHA_TOPIC, SABHA_QUESTIONS, MORE_QUESTIONS, LOGIC_TOPIC, LOGIC_QUESTIONS };
