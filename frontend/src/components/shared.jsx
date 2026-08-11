import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isMuted, setMuted } from '../utils/sounds';

/* ── NAV ──────────────────────────────────────────────────────────────── */
export function Nav({ onBack, backLabel = '← Back', title, right }) {
  const { state } = useApp();
  const [muted, setMutedState] = useState(isMuted());
  const toggleMute = () => { const next = !muted; setMuted(next); setMutedState(next); };
  return (
    <nav className="nav nav-wrap">
      <div className="fl fla gap2" style={{minWidth:0}}>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack} style={{flexShrink:0}}>{backLabel}</button>}
        {title
          ? <span className="nav-title" style={{ fontWeight:800, fontSize:'1.05rem' }}>{title}</span>
          : <span className="logo">BrainBoom</span>
        }
      </div>
      <div className="fl fla gap2" style={{flexWrap:'wrap',justifyContent:'flex-end'}}>
        {right}
        <button className="btn btn-ghost btn-sm" onClick={toggleMute} title={muted ? 'Unmute sound effects' : 'Mute sound effects'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <span className="fl fla gap1 fs-xs mut nav-conn-status">
          <span className={`conn-dot ${state.connected ? 'conn-online' : 'conn-offline'}`} />
          {state.connected ? 'Live' : 'Offline'}
        </span>
      </div>
    </nav>
  );
}

/* ── MODAL ──────────────────────────────────────────────────────────────── */
export function Modal({ show, onClose, children, wide }) {
  if (!show) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: wide ? 720 : 500 }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ── TOAST CONTAINER ─────────────────────────────────────────────────── */
export function ToastContainer() {
  const { state, dispatch } = useApp();
  useEffect(() => {
    if (state.toasts.length === 0) return;
    const last = state.toasts[state.toasts.length - 1];
    const t = setTimeout(() => dispatch({ type:'REMOVE_TOAST', id: last.id }), 3200);
    return () => clearTimeout(t);
  }, [state.toasts, dispatch]);

  return (
    <div className="toast-wrap">
      {state.toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type==='success'?'✅':t.type==='error'?'❌':t.type==='warn'?'⚠️':'ℹ️'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ── BG ORBS ────────────────────────────────────────────────────────── */
export function BgOrbs() {
  return (
    <div className="bg-orbs">
      <div className="orb" style={{ width:500,height:500,top:'0%',  left:'-10%', background:'#4F8CFF', animationDelay:'0s' }}/>
      <div className="orb" style={{ width:380,height:380,top:'55%', right:'-8%', background:'#7B61FF', animationDelay:'3s' }}/>
      <div className="orb" style={{ width:280,height:280,top:'20%', left:'60%',  background:'#FFD93D', animationDelay:'6s' }}/>
    </div>
  );
}

/* ── CONFETTI ───────────────────────────────────────────────────────── */
export function Confetti({ active }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    const cols = ['#4F8CFF','#7B61FF','#FFD93D','#4CAF50','#FF5252','#FF8C42','#FF6B9D'];
    setPieces(Array.from({ length:70 }, (_,i) => ({
      id:i, left:`${Math.random()*100}%`,
      bg:cols[i%cols.length],
      dur:`${.8+Math.random()*1.4}s`, del:`${Math.random()*.6}s`,
      w:`${5+Math.random()*9}px`, h:`${5+Math.random()*9}px`,
      br: Math.random()>.5 ? '50%':'2px',
    })));
    const t = setTimeout(() => setPieces([]), 3500);
    return () => clearTimeout(t);
  }, [active]);
  return <>{pieces.map(p => (
    <div key={p.id} className="conf-piece"
      style={{ left:p.left, top:'-10px', background:p.bg, width:p.w, height:p.h, borderRadius:p.br,
        animation:`conffall ${p.dur} ease-in ${p.del} both` }} />
  ))}</>;
}

/* ── TIMER RING ─────────────────────────────────────────────────────── */
export function TimerRing({ value, max, size = 64, paused = false }) {
  const r   = (size - 10) / 2;
  const c   = 2 * Math.PI * r;
  const pct = Math.max(0, value / Math.max(1, max));
  const col = paused ? '#9AA3B2' : pct > .5 ? '#4F8CFF' : pct > .25 ? '#FFD93D' : '#FF5252';
  const warn= !paused && pct <= .25;
  return (
    <div className="timer-wrap" style={{ width:size, height:size, opacity: paused ? .7 : 1 }}>
      <svg className="timer-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c*(1-pct)}
          style={{ transition:'stroke-dashoffset .2s linear, stroke .3s' }}/>
      </svg>
      <div className="timer-label" style={{ color:col, fontSize: size > 60 ? '1.2rem':'0.95rem', animation: warn ? 'timerWarn .5s ease infinite':'' }}>
        {paused ? '⏸' : value}
      </div>
    </div>
  );
}

/* ── TEAM PILL ──────────────────────────────────────────────────────── */
export function TeamPill({ team, size = 'md' }) {
  if (!team) return null;
  const pad = size==='sm' ? '4px 9px' : '6px 13px';
  const fs  = size==='sm' ? '.82rem' : '.9rem';
  return (
    <span className="team-pill" style={{ color:team.color, borderColor:`${team.color}66`, background:`${team.color}18`, padding:pad, fontSize:fs }}>
      {team.emoji} {team.name}
    </span>
  );
}

/* ── TOGGLE SWITCH ──────────────────────────────────────────────────── */
export function Toggle({ checked, onChange, label }) {
  return (
    <div className="fl fla gap2" style={{ cursor:'pointer' }} onClick={onChange}>
      <div style={{ width:44, height:24, borderRadius:12, position:'relative', background: checked?'var(--blue2)':'rgba(255,255,255,.15)', transition:'.2s', flexShrink:0 }}>
        <span style={{ position:'absolute', top:2, left: checked?22:2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'.2s', display:'block' }}/>
      </div>
      {label && <span className="fs-sm fw8 mut">{label}</span>}
    </div>
  );
}

/* ── LOADING SPINNER ────────────────────────────────────────────────── */
export function Spinner({ size = 24 }) {
  return <div style={{ width:size, height:size, border:`3px solid rgba(255,255,255,.1)`, borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>;
}

/* ── ERROR BANNER ───────────────────────────────────────────────────── */
export function ErrorBanner({ msg, onRetry }) {
  if (!msg) return null;
  return (
    <div style={{ background:'rgba(255,82,82,.12)', border:'1px solid rgba(255,82,82,.3)', borderRadius:14, padding:'14px 18px', margin:'16px', display:'flex', alignItems:'center', gap:12 }}>
      <span style={{ fontSize:'1.3rem' }}>❌</span>
      <span className="fl1 fs-sm rdc fw8">{msg}</span>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

/* ── TEAM SCORE ROW ─────────────────────────────────────────────────── */
export function TeamScoreRow({ team, rank, highlight, animate }) {
  const medals = ['🥇','🥈','🥉'];
  return (
    <div className="fl fla gap3" style={{
      padding:'12px 16px', borderRadius:14, marginBottom:8,
      background: highlight ? `${team.color}18` : 'var(--c1)',
      border: `1.5px solid ${highlight ? team.color+'55' : 'rgba(255,255,255,.07)'}`,
      animation: animate ? `slideL .3s ease ${rank*0.06}s both` : '',
      transition:'all .3s',
    }}>
      <span style={{ fontSize:'1.3rem', minWidth:28 }}>{medals[rank-1] || `#${rank}`}</span>
      <span style={{ fontSize:'1.5rem' }}>{team.emoji}</span>
      <div className="fl1">
        <div className="fw8">{team.name}</div>
        <div className="fs-xs mut">{team.playerCount||0} players{team.streak>=2 ? ' · ' : ''}{team.streak>=2 && <span style={{color:'var(--yellow)',fontWeight:800}}>🔥 {team.streak} streak</span>}</div>
      </div>
      <div className="tr">
        <div style={{ fontSize:'1.3rem', fontWeight:900, color:team.color }}>{team.score}</div>
        <div className="fs-xs mut">pts</div>
      </div>
    </div>
  );
}
