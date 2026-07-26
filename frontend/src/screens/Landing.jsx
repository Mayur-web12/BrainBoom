import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';

/* ═══════════════════════════════════════════════════════
   LANDING — public home page, student-facing only
═══════════════════════════════════════════════════════ */
export function Landing() {
  const { go } = useApp();
  return (
    <div className="screen" style={{ alignItems:'center', justifyContent:'center', textAlign:'center', padding:'0px 20px' }}>
      {/* <div style={{animation:'bounce 2.5s ease-in-out infinite'}}> */}
  <img src="/assets/logo.png" alt="BrainBoom Logo" width="300" />
{/* </div> */}
      <h1 style={{
        fontSize:'clamp(2rem,8vw,3rem)', lineHeight:1.05, margin:'14px 0',
        background:'linear-gradient(135deg,#fff 0%,#4F8CFF 35%,#7B61FF 65%,#FFD93D 100%)',
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
      }}>BrainBoom</h1>
      <p style={{ fontSize:'1.08rem', color:'var(--t2)', maxWidth:600, margin:'0 auto 20px', lineHeight:1.75 }}>
        Real-time team quiz battles. Pick topics, earn points, compete! 🏆
      </p>

      <div className="fl flw flc gap2" style={{ marginBottom:32, justifyContent:'center' }}>
        {['📱 Multi-Device','🖥️ Single Screen','👤 Individual Play','💰 Points +/-','🏆 Leaderboard'].map(f => (
          <span key={f} style={{ padding:'5px 13px', borderRadius:20, fontSize:'0.88rem', fontWeight:700, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)' }}>{f}</span>
        ))}
      </div>

      {/* Three modes */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, maxWidth:1330, width:'100%', margin:'0 auto 20px'}}>

        {/* Team Multi-device */}
        <div onClick={() => go('student-join')}
          style={{ background:'var(--c1)', borderRadius:22, padding:'28px 20px', textAlign:'center', cursor:'pointer', border:'2px solid transparent', transition:'.3s', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--blue)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>📱</div>
          <div style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:25 }}>Team Game</div>
          <p className="mut fs-sm" style={{ lineHeight:1.6, marginBottom:25 }}>Enter a code from your mentor. Join a team and play on your own device.</p>
          <span className="badge b-blue">Multi-Device</span>
        </div>

        {/* Individual Player */}
        <div onClick={() => go('individual-join')}
          style={{ background:'var(--c1)', borderRadius:22, padding:'28px 20px', textAlign:'center', cursor:'pointer', border:'2px solid transparent', transition:'.3s', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--green)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>🏅</div>
          <div style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:25 }}>Solo Player</div>
          <p className="mut fs-sm" style={{ lineHeight:1.6, marginBottom:25 }}>Join individually. Compete by name. Live student-vs-student leaderboard!</p>
          <span className="badge b-green">Individual</span>
        </div>

        {/* Single screen / shared mode */}
        <div onClick={() => go('shared-game')}
          style={{ background:'var(--c1)', borderRadius:22, padding:'28px 20px', textAlign:'center', cursor:'pointer', border:'2px solid transparent', transition:'.3s', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--yellow)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>🖥️</div>
          <div style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:25 }}>Shared Screen</div>
          <p className="mut fs-sm" style={{ lineHeight:1.6, marginBottom:25 }}>All teams play on one screen. No phones needed. Take turns!</p>
          <span className="badge b-yellow">Single Device</span>
        </div>

        {/* Practice mode — solo, untimed, learn-at-your-own-pace */}
        <div onClick={() => go('practice')}
          style={{ background:'var(--c1)', borderRadius:22, padding:'28px 20px', textAlign:'center', cursor:'pointer', border:'2px solid transparent', transition:'.3s', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#F59E0B'}
          onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>🎯</div>
          <div style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:25 }}>Practice Mode</div>
          <p className="mut fs-sm" style={{ lineHeight:1.6, marginBottom:25 }}>Learn solo at your own pace. Read-aloud, instant answers, earn ⭐ stars!</p>
          <span className="badge b-yellow">⏱️ No Time Limit</span>
        </div>
      </div>

      {/* <p className="mut fs-xs" style={{ opacity:.45 }}>
        Are you a mentor? Access the dashboard via your private link.
      </p> */}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MENTOR GATE — /mentor URL redirects here silently
═══════════════════════════════════════════════════════ */
export function MentorGate() {
  const { go } = useApp();
  useEffect(() => {
    const t = setTimeout(() => go('mentor-login'), 80);
    return () => clearTimeout(t);
  }, [go]);
  return (
    <div className="screen" style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:'2rem', animation:'spin 1s linear infinite' }}>⏳</div>
    </div>
  );
}
