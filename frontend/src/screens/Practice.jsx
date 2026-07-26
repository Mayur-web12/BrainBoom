import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Nav, Confetti, Spinner } from '../components/shared';
import { playCorrect, playWrong } from '../utils/sounds';

/* ═══════════════════════════════════════════════════════════════════════════
   PRACTICE MODE — solo, untimed, self-paced learning.
   No mentor, no game code. A child picks a topic and answers at their own pace.
   After each answer the correct option + explanation is revealed, so questions
   are easy to remember.  Stars and streaks make it rewarding.
   Includes optional read-aloud (browser SpeechSynthesis) for early readers.
═══════════════════════════════════════════════════════════════════════════ */

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

// ── Read-aloud helper (free, browser-native, no backend) ──────────────────────
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.15; // slightly higher pitch = friendlier for kids
    window.speechSynthesis.speak(u);
  } catch (_) {}
}
function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch (_) {} }

function badgeFor(pct) {
  if (pct >= 90) return { emoji:'🏆', label:'Quiz Champion!' };
  if (pct >= 70) return { emoji:'🌟', label:'Super Star!' };
  if (pct >= 50) return { emoji:'👍', label:'Great Effort!' };
  return { emoji:'🌱', label:'Keep Practising!' };
}

function QuestionMedia({ url, type }) {
  if (!url) return null;
  const isYT = /youtube\.com|youtu\.be/.test(url);
  const ytEmbed = () => {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  };
  const kind = type || (isYT ? 'youtube' : /\.(jpg|jpeg|png|webp|gif)/i.test(url) ? 'image' : /\.(mp4|webm)/i.test(url) ? 'video' : 'image');
  return (
    <div style={{ borderRadius:14, overflow:'hidden', margin:'0 0 14px' }}>
      {kind === 'image' && <img src={url} alt="" style={{ width:'100%', maxHeight:220, objectFit:'contain', display:'block' }} />}
      {kind === 'video' && !isYT && <video src={url} controls style={{ width:'100%', maxHeight:220, display:'block' }} />}
      {(kind === 'youtube' || isYT) && <iframe src={ytEmbed()} title="video" style={{ width:'100%', height:200, border:'none', display:'block' }} allowFullScreen />}
    </div>
  );
}

export function Practice() {
  const { go, state } = useApp();
  const topicMeta = state.topicMeta || {};

  const [phase, setPhase]       = useState('pick');   // pick | quiz | done
  const [loading, setLoading]   = useState(false);
  const [topic, setTopic]       = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx]           = useState(0);
  const [picked, setPicked]     = useState(null);     // selected option index
  const [stars, setStars]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [bestStreak, setBest]   = useState(0);
  const [soundOn, setSoundOn]   = useState(true);
  const [counts, setCounts]     = useState({});       // topic -> #questions
  const burstRef = useRef(false);

  const topics = Object.entries(topicMeta);

  // Load how many questions exist per topic (for the picker)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { questions: all } = await api.getQuestions();
        if (cancelled) return;
        const c = {};
        all.forEach(q => { c[q.topic] = (c[q.topic] || 0) + 1; });
        setCounts(c);
      } catch (_) {}
    })();
    return () => { cancelled = true; stopSpeaking(); };
  }, []);

  const startTopic = async (name) => {
    setLoading(true); setTopic(name);
    try {
      const { questions: qs } = await api.getQuestions({ topic: name });
      const pool = shuffle(qs).slice(0, 15);
      if (pool.length === 0) { setLoading(false); setPhase('pick'); return; }
      setQuestions(pool);
      setIdx(0); setPicked(null); setStars(0); setStreak(0); setBest(0);
      setPhase('quiz');
    } catch (_) {} finally { setLoading(false); }
  };

  const q = questions[idx];
  const correctIdx = q?.ans?.[0];
  const answered = picked !== null;
  const isCorrect = answered && q?.ans?.includes(picked);

  // Read the question aloud when it appears
  useEffect(() => {
    if (phase === 'quiz' && q && soundOn) {
      speak(`${q.q}. ${q.opts.map((o, i) => `Option ${i + 1}: ${o}`).join('. ')}`);
    }
    burstRef.current = false;
    return () => stopSpeaking();
  }, [idx, phase]); // eslint-disable-line

  const choose = (i) => {
    if (answered) return;
    setPicked(i);
    const good = q.ans.includes(i);
    if (good) {
      playCorrect();
      setStars(s => s + 1);
      setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
      if (soundOn) speak('Correct! ' + (q.exp || ''));
    } else {
      playWrong();
      setStreak(0);
      if (soundOn) speak('Not quite. ' + (q.exp || `The answer is ${q.opts[correctIdx]}.`));
    }
  };

  const next = () => {
    stopSpeaking();
    if (idx + 1 >= questions.length) { setPhase('done'); return; }
    setIdx(i => i + 1); setPicked(null);
  };

  const total = questions.length;
  const pct = total ? Math.round((stars / total) * 100) : 0;

  // ── PICK A TOPIC ────────────────────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <div className="screen">
        <Nav onBack={() => go('landing')} title="🎯 Practice Mode" />
        <div style={{ padding:'80px 20px 40px', maxWidth:900, margin:'0 auto', width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize:'3.4rem' }}>📚</div>
            <h2 style={{ fontSize:'1.7rem', margin:'8px 0' }}>Pick a topic to practise</h2>
            <p className="mut fs-sm">No timer, no pressure. Learn at your own pace and earn ⭐ stars!</p>
          </div>
          {loading && <div style={{ textAlign:'center', padding:20 }}><Spinner /></div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:14 }}>
            {topics.map(([name, meta]) => {
              const n = counts[name] || 0;
              const disabled = n === 0;
              return (
                <div key={name}
                  onClick={() => !disabled && startTopic(name)}
                  style={{
                    background:'var(--c1)', borderRadius:18, padding:'22px 14px', textAlign:'center',
                    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .4 : 1,
                    border:`2px solid ${meta.color || '#4F8CFF'}33`, transition:'.2s',
                  }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = meta.color || '#4F8CFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = (meta.color || '#4F8CFF') + '33'; }}>
                  <div style={{ fontSize:'2.4rem', marginBottom:6 }}>{meta.emoji || '📚'}</div>
                  <div style={{ fontWeight:800 }}>{name}</div>
                  <div className="mut fs-xs" style={{ marginTop:4 }}>{n} question{n === 1 ? '' : 's'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const b = badgeFor(pct);
    return (
      <div className="screen">
        <Confetti active={pct >= 50} />
        <div style={{ padding:'40px 20px', maxWidth:520, margin:'auto', width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:'5rem', animation:'bounce 2s ease-in-out infinite' }}>{b.emoji}</div>
          <h1 style={{ fontSize:'2rem', margin:'10px 0' }}>{b.label}</h1>
          <p className="mut" style={{ marginBottom:20 }}>{topicMeta[topic]?.emoji} {topic} practice complete</p>
          <div style={{ display:'flex', justifyContent:'center', gap:14, marginBottom:26, flexWrap:'wrap' }}>
            <div style={{ background:'var(--c1)', borderRadius:16, padding:'16px 22px' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:900 }}>⭐ {stars}/{total}</div>
              <div className="mut fs-xs">Stars earned</div>
            </div>
            <div style={{ background:'var(--c1)', borderRadius:16, padding:'16px 22px' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:900 }}>🔥 {bestStreak}</div>
              <div className="mut fs-xs">Best streak</div>
            </div>
            <div style={{ background:'var(--c1)', borderRadius:16, padding:'16px 22px' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:900 }}>{pct}%</div>
              <div className="mut fs-xs">Score</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => startTopic(topic)}>🔁 Try Again</button>
            <button className="btn btn-ghost btn-lg" onClick={() => { setPhase('pick'); setTopic(null); }}>📚 New Topic</button>
            <button className="btn btn-ghost btn-lg" onClick={() => go('landing')}>🏠 Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ ────────────────────────────────────────────────────────────────────
  const meta = topicMeta[topic] || {};
  return (
    <div className="screen">
      <Nav onBack={() => { stopSpeaking(); setPhase('pick'); setTopic(null); }} title={`${meta.emoji || '📚'} ${topic}`}
        right={
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span title="Stars" style={{ fontWeight:800 }}>⭐ {stars}</span>
            <span title="Streak" style={{ fontWeight:800 }}>🔥 {streak}</span>
            <button onClick={() => { const on = !soundOn; setSoundOn(on); if (!on) stopSpeaking(); }}
              className="btn btn-ghost btn-sm" title="Read aloud">{soundOn ? '🔊' : '🔇'}</button>
          </div>
        } />

      <div style={{ padding:'76px 18px 30px', maxWidth:1300, margin:'0 auto', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:18 }}>
        {/* Left mascot — dummy placeholder, swap frontend/public/assets/characters/left-mascot.png with real art anytime */}
        <img src="/assets/characters/left-mascot.png" alt="" aria-hidden="true" className="practice-mascot practice-mascot-left"
          style={{ animation: answered ? (isCorrect ? 'bounce .8s ease-in-out' : 'shake .5s ease') : 'float 4s ease-in-out infinite' }} />

        <div style={{ maxWidth:640, width:'100%' }}>
        {/* progress bar */}
        <div style={{ height:8, borderRadius:20, background:'rgba(255,255,255,.08)', marginBottom:18, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${((idx) / total) * 100}%`, background:meta.color || '#4F8CFF', transition:'.3s' }} />
        </div>
        <div className="mut fs-xs" style={{ marginBottom:12 }}>Question {idx + 1} of {total}</div>

        <div className="card" style={{ padding:'22px 20px' }}>
          <QuestionMedia url={q.mediaUrl} type={q.mediaType} />
          <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:18 }}>
            <h2 style={{ fontSize:'1.35rem', lineHeight:1.4, flex:1 }}>{q.q}</h2>
            <button className="btn btn-ghost btn-sm" title="Hear the question" onClick={() => speak(q.q + '. ' + q.opts.join(', '))}>🔊</button>
          </div>

          <div style={{ display:'grid', gap:10 }}>
            {q.opts.map((opt, i) => {
              let bg = 'var(--c2)', border = '2px solid transparent';
              if (answered) {
                if (i === correctIdx) { bg = 'rgba(0,212,170,.18)'; border = '2px solid #00D4AA'; }
                else if (i === picked) { bg = 'rgba(255,82,82,.15)'; border = '2px solid #FF5252'; }
              }
              return (
                <button key={i} onClick={() => choose(i)} disabled={answered}
                  style={{
                    textAlign:'left', padding:'14px 16px', borderRadius:14, background:bg, border,
                    color:'var(--t1)', fontSize:'1.05rem', fontWeight:600, cursor: answered ? 'default' : 'pointer',
                    display:'flex', alignItems:'center', gap:10, transition:'.15s',
                  }}>
                  <span style={{ fontWeight:900, opacity:.6 }}>{String.fromCharCode(65 + i)}</span>
                  <span style={{ flex:1 }}>{opt}</span>
                  {answered && i === correctIdx && <span>✅</span>}
                  {answered && i === picked && i !== correctIdx && <span>❌</span>}
                </button>
              );
            })}
          </div>

          {answered && (
            <div style={{
              marginTop:16, padding:'14px 16px', borderRadius:12,
              background: isCorrect ? 'rgba(0,212,170,.12)' : 'rgba(255,193,7,.12)',
              border: `1px solid ${isCorrect ? 'rgba(0,212,170,.4)' : 'rgba(255,193,7,.4)'}`,
            }}>
              <div style={{ fontWeight:800, marginBottom:4 }}>
                {isCorrect ? '🎉 Correct! Well done!' : `💡 The answer is: ${q.opts[correctIdx]}`}
              </div>
              {q.exp && <div className="fs-sm" style={{ lineHeight:1.6 }}>{q.exp}</div>}
            </div>
          )}

          {answered && (
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop:16 }} onClick={next}>
              {idx + 1 >= total ? '🏁 See My Results' : 'Next Question →'}
            </button>
          )}
        </div>
        </div>

        {/* Right mascot — dummy placeholder, swap frontend/public/assets/characters/right-mascot.png with real art anytime */}
        <img src="/assets/characters/right-mascot.png" alt="" aria-hidden="true" className="practice-mascot practice-mascot-right"
          style={{ animation: answered ? (isCorrect ? 'bounce .8s ease-in-out .1s' : 'shake .5s ease .05s') : 'float 4s ease-in-out infinite .5s' }} />
      </div>
    </div>
  );
}
