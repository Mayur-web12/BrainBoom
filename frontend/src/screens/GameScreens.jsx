import React, { useState, useEffect, useCallback } from 'react';
import { useApp, getTopicEmoji, getTopicColor } from '../context/AppContext';
import { api } from '../utils/api';
import { useEmit } from '../hooks/useSocket';
import { TimerRing, Confetti, TeamScoreRow } from '../components/shared';
import { playCorrect, playWrong, playWinner } from '../utils/sounds';

const LETTERS = ['A','B','C','D','E','F'];
const DIFF_PTS = { easy:{correct:100,wrong:50}, medium:{correct:150,wrong:75}, hard:{correct:200,wrong:100} };
const TEAM_PRESETS = [
  { id:'A', name:'Team Alpha',   color:'#4F8CFF', emoji:'🔵' },
  { id:'B', name:'Team Bravo',   color:'#FF5252', emoji:'🔴' },
  { id:'C', name:'Team Charlie', color:'#4CAF50', emoji:'🟢' },
  { id:'D', name:'Team Delta',   color:'#FFD93D', emoji:'🟡' },
  { id:'E', name:'Team Echo',    color:'#FF6B9D', emoji:'🩷' },
  { id:'F', name:'Team Foxtrot', color:'#00D4AA', emoji:'🩵' },
];


function tEmoji(name, tm) { return getTopicEmoji(name,tm); }
function tColor(name, tm) { return getTopicColor(name,tm); }

// ── QUESTION MEDIA RENDERER ───────────────────────────────────────────────────
// Shown after every question — mentor + Sabha "KK" reacting to the result.
// Dummy placeholders live at /public/assets/characters/mentor.png and
// sabha-kk.png — swap those files with real transparent-background art anytime.
function MentorReaction({ correct }) {
  return (
    <div className="fl fla flc gap3" style={{ marginTop: 14, marginBottom: 4 }}>
      <img src="/assets/characters/mentor.png" alt="" aria-hidden="true"
        style={{ width: 56, height: 'auto', filter: correct ? 'none' : 'grayscale(.25)' }} />
      <div className="badge b-purple" style={{ fontSize:'0.8rem' }}>{correct ? '🎉 Great job!' : '💡 Keep trying!'}</div>
      <img src="/assets/characters/sabha-kk.png" alt="" aria-hidden="true"
        style={{ width: 56, height: 'auto', filter: correct ? 'none' : 'grayscale(.25)' }} />
    </div>
  );
}

function QuestionMedia({ url, type }) {
  if (!url) return null;
  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const getYTEmbed = (u) => {
    const m = u.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0` : u;
  };
  const resolvedType = type || (isYouTube ? 'youtube' : /\.(jpg|jpeg|png|webp)/i.test(url) ? 'image' : /\.(mp4|webm)/i.test(url) ? 'video' : null);
  if (!resolvedType || resolvedType === 'none') return null;
  return (
    <div style={{ marginTop:14, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,.1)', background:'rgba(0,0,0,.35)', maxWidth:'100%' }}>
      {resolvedType === 'image' && (
        <img src={url} alt="Question media" style={{ width:'100%', maxHeight:260, objectFit:'contain', display:'block' }} onError={e=>e.target.style.display='none'} />
      )}
      {resolvedType === 'video' && !isYouTube && (
        <video src={url} controls style={{ width:'100%', maxHeight:260, display:'block' }} />
      )}
      {(resolvedType === 'youtube' || (resolvedType === 'video' && isYouTube)) && (
        <iframe src={getYTEmbed(url)} title="Question video" style={{ width:'100%', height:220, border:'none', display:'block' }} allowFullScreen />
      )}
    </div>
  );
}

function teamProgress(gs, teamId) {
  const played = (gs?.roundHistory||[]).filter(r=>r.teamId===teamId).length;
  const total  = gs?.questionsPerTeam||10;
  return { played, total, pct: Math.min(100, Math.round((played/total)*100)) };
}

/* ════════════════════════════════════════════════════════════
   LOBBY
════════════════════════════════════════════════════════════ */
export function Lobby() {
  const { state } = useApp();
  const gs = state.gameState;
  if (!gs) return null;
  const isIndividual = state.player?.mode === 'individual';
  const myTeam = gs.teams?.find(t=>t.id===state.player?.teamId);

  // Collect all players across teams for individual mode display
  const allPlayers = gs.teams?.flatMap(t => (t.players||[]).map(p=>({...p, teamColor:t.color, teamEmoji:t.emoji}))) || [];
  const totalJoined = allPlayers.length || gs.teams?.reduce((a,t)=>a+t.playerCount,0) || 0;

  return (
    <div className="screen" style={{alignItems:'center',justifyContent:'center',padding:20,textAlign:'center'}}>
      <div style={{fontSize:'3.5rem',marginBottom:16,animation:'bounce 2.5s ease-in-out infinite'}}>⏳</div>
      <h2 style={{fontSize:'1.9rem',marginBottom:8}}>You're In the Lobby!</h2>

      {/* Player chip */}
      <div style={{display:'inline-flex',alignItems:'center',gap:12,padding:'12px 22px',borderRadius:24,
        background: isIndividual ? 'rgba(76,175,80,.15)' : `${myTeam?.color}22`,
        border: `2px solid ${isIndividual ? 'rgba(76,175,80,.5)' : myTeam?.color+'66'}`,marginBottom:22}}>
        <span style={{fontSize:'1.8rem'}}>{state.player?.avatar}</span>
        <div style={{textAlign:'left'}}>
          {isIndividual
            ? <><div className="fw8 fs-lg" style={{color:'var(--green)'}}>🏅 Solo Player</div><div className="mut fs-xs">{state.player?.name}</div></>
            : <><div className="fw8 fs-lg" style={{color:myTeam?.color}}>{myTeam?.name}</div><div className="mut fs-xs">{state.player?.name}</div></>
          }
        </div>
      </div>

      <p className="mut fs-sm" style={{marginBottom:24,lineHeight:1.7}}>
        Waiting for mentor to start…<br/>Code: <strong style={{color:'var(--blue)',fontFamily:'Fredoka,cursive',letterSpacing:4}}>{gs.code}</strong>
      </p>

      <div style={{maxWidth:560,width:'100%',margin:'0 auto'}}>
        {isIndividual ? (
          /* Individual mode: show player list */
          <>
            <div className="sec-title" style={{justifyContent:'center'}}>🏅 Players Joined ({totalJoined})</div>
            {allPlayers.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {allPlayers.map((p,i)=>(
                  <div key={p.socketId||i} style={{
                    display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                    borderRadius:14,background: p.name===state.player?.name ? 'rgba(76,175,80,.15)' : 'var(--bg3)',
                    border:`1.5px solid ${p.name===state.player?.name ? 'rgba(76,175,80,.5)' : 'rgba(255,255,255,.1)'}`,
                  }}>
                    <span style={{fontSize:'1.4rem'}}>{p.avatar||'🦁'}</span>
                    <span className="fw8 fs-sm" style={{color:p.name===state.player?.name?'var(--green)':'var(--t1)'}}>{p.name}</span>
                    {p.name===state.player?.name && <span className="badge b-green" style={{marginLeft:'auto',fontSize:'0.75rem'}}>You</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mut fs-sm" style={{padding:16}}>Waiting for more players…</div>
            )}
          </>
        ) : (
          /* Team mode: show team grid */
          <>
            <div className="sec-title" style={{justifyContent:'center'}}>👥 Teams</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
              {gs.teams?.map(t=>(
                <div key={t.id} style={{background:`${t.color}18`,borderRadius:14,padding:14,border:`1.5px solid ${t.color}44`,textAlign:'center',boxShadow:t.id===myTeam?.id?`0 0 14px ${t.color}55`:undefined}}>
                  <div style={{fontSize:'1.8rem',marginBottom:5}}>{t.emoji}</div>
                  <div className="fw8 fs-sm" style={{color:t.color}}>{t.name}</div>
                  <div className="badge b-purple" style={{marginTop:5,fontSize:'0.75rem'}}>{t.playerCount} players</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mut fs-xs mt4" style={{marginTop:24,animation:'pulse 2s infinite'}}>🔴 Live · Waiting for mentor</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TOPIC PICK SCREEN
════════════════════════════════════════════════════════════ */
export function TopicPickScreen() {
  const { state, toast } = useApp();
  const emit   = useEmit();
  const gs     = state.gameState;
  const tm     = state.topicMeta;
  const player = state.player;
  const [picking, setPicking] = useState(false);

  if (!gs) return null;

  const isIndividual = gs.mode === 'individual' || player?.mode === 'individual';
  const myTeamId   = player?.teamId;
  const currentId  = gs.currentTeamId;
  const isMyTurn   = myTeamId === currentId;
  const curTeam    = gs.teams?.find(t=>t.id===currentId);
  const myTeam     = gs.teams?.find(t=>t.id===myTeamId);
  const available  = gs.availableTopics || [];

  // For solo mode: total rounds = questionsPerTeam (1 team)
  // For team mode: total rounds = questionsPerTeam × number of teams
  const totalRnds = isIndividual
    ? (gs.questionsPerTeam || 5)
    : (gs.questionsPerTeam || 10) * (gs.teams?.length || 1);

  const roundsDone = gs.roundNumber || 0;
  const atLimit    = isIndividual && roundsDone >= totalRnds;
  const progressPct = Math.min(100, Math.round((roundsDone / Math.max(1, totalRnds)) * 100));

  // Per-topic: how many questions have been used from each topic
  const topicUsedCount = {};
  (gs.roundHistory || []).forEach(r => {
    if (r.topic) topicUsedCount[r.topic] = (topicUsedCount[r.topic] || 0) + 1;
  });

  const pick = async (topic) => {
    if (!isMyTurn || picking || atLimit) return;
    setPicking(true);
    try { await emit('pick-topic', { code: gs.code, teamId: myTeamId, topic }); }
    catch(err) { toast(err.message, 'error'); setPicking(false); }
  };

  return (
    <div className="screen">
      {/* Header */}
      <div style={{padding:'12px 18px',background:'rgba(8,6,22,.9)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div className="fl fla gap2">
          {isIndividual ? (
            <div style={{padding:'4px 10px',borderRadius:10,background:'rgba(76,175,80,.15)',border:'1.5px solid rgba(76,175,80,.4)',display:'flex',alignItems:'center',gap:6}}>
              <span>🏅</span><span className="fw8 fs-sm" style={{color:'var(--green)'}}>Solo Players</span>
            </div>
          ) : (
            myTeam && <div style={{padding:'4px 10px',borderRadius:10,background:`${myTeam.color}22`,border:`1.5px solid ${myTeam.color}55`,display:'flex',alignItems:'center',gap:6}}>
              <span>{myTeam.emoji}</span><span className="fw8 fs-sm" style={{color:myTeam.color}}>{myTeam.name}</span>
            </div>
          )}
        </div>
        <span className="mut fs-xs">
          Questions: <strong style={{color: atLimit ? 'var(--red)' : 'var(--blue)'}}>{roundsDone}/{totalRnds}</strong>
          {' '}· Code: <strong style={{color:'var(--blue)'}}>{gs.code}</strong>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{padding:'0 18px'}}>
        <div className="progress-bar" style={{marginTop:6}}>
          <div className="progress-fill" style={{width:`${progressPct}%`, background: atLimit ? 'var(--red)' : 'linear-gradient(90deg,var(--blue),var(--blue2))'}}/>
        </div>
      </div>

      <div style={{flex:1, padding:'16px 18px', maxWidth:800, margin:'0 auto', width:'100%'}}>

        {/* At-limit banner for solo mode */}
        {atLimit && isIndividual && (
          <div style={{padding:'14px 18px',borderRadius:16,marginBottom:18,background:'rgba(255,82,82,.1)',border:'2px solid rgba(255,82,82,.4)',textAlign:'center'}}>
            <div style={{fontSize:'1.5rem',marginBottom:6}}>🏁</div>
            <div className="fw8 fs-lg" style={{color:'var(--red)'}}>All {totalRnds} questions completed!</div>
            <div className="mut fs-sm" style={{marginTop:4}}>Waiting for results…</div>
          </div>
        )}

        {/* Whose-turn banner */}
        {!atLimit && (
          <div style={{padding:'14px 18px',borderRadius:16,marginBottom:18,
            background: isMyTurn ? (isIndividual ? 'rgba(76,175,80,.15)' : `${curTeam?.color}22`) : `${curTeam?.color}12`,
            border:`2px solid ${isMyTurn ? (isIndividual ? 'rgba(76,175,80,.6)' : curTeam?.color+'99') : curTeam?.color+'33'}`,
            animation: isMyTurn ? 'glow 2.5s infinite' : '',
            display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:'2rem'}}>{isIndividual ? '🏅' : curTeam?.emoji}</span>
            <div style={{flex:1}}>
              <div className="fw8 fs-lg" style={{color: isMyTurn ? (isIndividual ? 'var(--green)' : curTeam?.color) : curTeam?.color}}>
                {isMyTurn ? '🎯 Your turn! Pick a topic below.' : `${curTeam?.name} is choosing…`}
              </div>
              <div className="mut fs-xs mt1" style={{marginTop:4}}>
                {available.length} topic{available.length !== 1 ? 's' : ''} available
                {' '}· {roundsDone}/{totalRnds} questions done
              </div>
            </div>
          </div>
        )}

        {/* Per-team progress (team mode only) */}
        {!isIndividual && (
          <div className="fl fla gap2 flw mb3" style={{marginBottom:16,flexWrap:'wrap'}}>
            {gs.teams?.map(t=>{ const p=teamProgress(gs,t.id); return (
              <div key={t.id} style={{flex:1,minWidth:110,padding:'8px 12px',borderRadius:12,background:`${t.color}15`,border:`1.5px solid ${t.color}44`}}>
                <div className="fl fla flb mb1" style={{marginBottom:5}}>
                  <span style={{fontSize:'0.9rem',fontWeight:800,color:t.color}}>{t.emoji} {t.name}</span>
                  <span className="fs-xs mut">{p.played}/{p.total}</span>
                </div>
                <div className="progress-bar" style={{height:5}}><div className="progress-fill" style={{width:`${p.pct}%`,background:t.color}}/></div>
              </div>
            );})}
          </div>
        )}

        {/* Topic grid */}
        <div className="sec-title">📚 Select a Topic</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20}}>
          {Object.entries(tm).map(([name, meta]) => {
            const isAvail  = available.includes(name);
            const usedCnt  = topicUsedCount[name] || 0;
            const canPick  = isAvail && isMyTurn && !picking && !atLimit;
            return (
              <button key={name} onClick={()=>canPick && pick(name)}
                disabled={!canPick}
                style={{borderRadius:18, padding:'18px 14px', textAlign:'center',
                  cursor: canPick ? 'pointer' : 'default',
                  background: isAvail ? `${meta.color}22` : 'rgba(255,255,255,.03)',
                  border:`2px solid ${isAvail ? meta.color+'66' : 'rgba(255,255,255,.06)'}`,
                  opacity: isAvail ? 1 : .32, transition:'.22s', color:'inherit'}}
                onMouseEnter={e=>{if(canPick){e.currentTarget.style.transform='translateY(-5px)';e.currentTarget.style.boxShadow=`0 10px 28px ${meta.color}44`;}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div style={{fontSize:'2.2rem',marginBottom:8}}>{meta.emoji}</div>
                <div className="fw8 fs-sm" style={{color:isAvail?meta.color:'var(--t3)'}}>{name}</div>
                {/* Show per-topic usage count */}
                {usedCnt > 0 && isAvail && (
                  <div className="fs-xs" style={{color:meta.color,opacity:.6,marginTop:3}}>Used {usedCnt}×</div>
                )}
                {!isAvail && <div className="fs-xs mut" style={{marginTop:4}}>All done ✓</div>}
                {isAvail && isMyTurn && !atLimit && <div className="fs-xs" style={{color:meta.color,opacity:.7,marginTop:4}}>Tap to pick</div>}
              </button>
            );
          })}
        </div>

        {/* Points table */}
        <div className="card" style={{padding:'12px 16px',marginBottom:14}}>
          <div className="sec-title" style={{margin:'0 0 10px',fontSize:'0.95rem'}}>💰 Points This Game</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {[['easy','🟢'],['medium','🟡'],['hard','🔴']].map(([d,ic])=>(
              <div key={d} style={{padding:'8px 10px',borderRadius:10,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',textAlign:'center'}}>
                <div className="fw8 fs-xs mb1" style={{marginBottom:4}}>{ic} {d[0].toUpperCase()+d.slice(1)}</div>
                <div className="fs-xs grn">✅ +{DIFF_PTS[d].correct}</div>
                <div className="fs-xs rdc">❌ −{DIFF_PTS[d].wrong}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scores section */}
        {state.mentor ? (
          <div className="card"><div className="sec-title">📊 All Scores</div>
            {gs.teams?[...gs.teams].sort((a,b)=>b.score-a.score).map((t,i)=><TeamScoreRow key={t.id} team={t} rank={i+1} highlight={t.id===currentId}/>):null}
          </div>
        ) : (() => {
          if (isIndividual) {
            const players = [...(state.individualPlayers || [])].sort((a,b)=>b.score-a.score);
            return (
              <div className="card" style={{padding:'14px 16px'}}>
                <div className="sec-title" style={{margin:'0 0 8px'}}>🏅 Solo Players Leaderboard</div>
                {players.length === 0
                  ? <div className="mut fs-sm">Waiting for players…</div>
                  : players.map((p,i) => (
                    <div key={p.socketId||p.name||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,marginBottom:6,
                      background:p.name===state.player?.name?'rgba(79,140,255,.12)':'rgba(255,255,255,.04)',
                      border:`1.5px solid ${p.name===state.player?.name?'rgba(79,140,255,.4)':'rgba(255,255,255,.08)'}`}}>
                      <span style={{fontSize:'1.05rem',minWidth:24}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                      <span style={{fontSize:'1.2rem'}}>{p.avatar||'🦁'}</span>
                      <span className="fw8 fs-sm fl1" style={{color:p.name===state.player?.name?'var(--blue)':'var(--t1)'}}>{p.name}{p.name===state.player?.name?' (You)':''}</span>
                      <span style={{fontSize:'1.15rem',fontWeight:900,color:'var(--blue)'}}>{p.score||0} pts</span>
                    </div>
                  ))
                }
              </div>
            );
          }
          const myTeamObj = gs.teams?.find(t=>t.id===state.player?.teamId);
          if (!myTeamObj) return null;
          return (
            <div className="card" style={{padding:'14px 16px'}}>
              <div className="sec-title" style={{margin:'0 0 8px'}}>🏅 Your Score</div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:'1.8rem'}}>{myTeamObj.emoji}</span>
                <div>
                  <div className="fw8" style={{color:myTeamObj.color}}>{myTeamObj.name}</div>
                  <div className="mut fs-xs">{teamProgress(gs,myTeamObj.id).played}/{teamProgress(gs,myTeamObj.id).total} questions done</div>
                </div>
                <div style={{marginLeft:'auto',fontSize:'1.8rem',fontWeight:900,color:myTeamObj.color}}>{myTeamObj.score} pts</div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GAME SCREEN  — answering
════════════════════════════════════════════════════════════ */
export function GameScreen() {
  const { state, toast } = useApp();
  const emit   = useEmit();
  const gs     = state.gameState;
  const tm     = state.topicMeta;
  const player = state.player;
  const [busy,      setBusy]      = useState(false);
  const [optStates, setOptStates] = useState({});
  const [answered,  setAnswered]  = useState(false);
  const [removedOpts, setRemovedOpts] = useState([]); // 50/50 lifeline
  const [lifelineBusy, setLifelineBusy] = useState(false);
  const [lockedIn,  setLockedIn]  = useState(false);

  useEffect(()=>{ setOptStates({}); setAnswered(false); setBusy(false); setRemovedOpts([]); setLockedIn(false); },[gs?.currentQuestion?.id]);

  if (!gs||!gs.question) return (
    <div className="screen" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:'3rem',animation:'pulse 1s infinite',marginBottom:12}}>⏳</div>
      <p className="fw8">Loading…</p>
    </div>
  );

  const q          = gs.question;
  const myTeamId   = player?.teamId;
  const curTeam    = gs.teams?.find(t=>t.id===gs.currentTeamId);
  const myTeam     = gs.teams?.find(t=>t.id===myTeamId);
  const isMyTurn   = myTeamId===gs.currentTeamId;
  const meta       = tm[q.topic]||{emoji:'🎯',color:'var(--blue)'};

  const isIndividual = gs.mode === 'individual' || player?.mode === 'individual';
  // Solo mode: totalRnds = questionsPerTeam; Team mode: questionsPerTeam × teams
  const totalRnds  = isIndividual
    ? (gs.questionsPerTeam || 5)
    : (gs.questionsPerTeam || 10) * (gs.teams?.length || 1);

  // Individual mode: every player can answer; team mode: only active team
  const canAnswer = isIndividual ? !answered && !busy : isMyTurn && !answered && !busy;

  const submit = async (idx) => {
    if (!canAnswer) return;
    setBusy(true); setAnswered(true); setLockedIn(true);
    const ns={}; q.opts.forEach((_,i)=>{if(i!==idx)ns[i]='hidden';}); setOptStates(ns);
    try {
      const event = isIndividual ? 'submit-individual-answer' : 'submit-answer';
      const payload = isIndividual
        ? { code:gs.code, answerIdx:idx }
        : { code:gs.code, teamId:myTeamId, answerIdx:idx };
      const res = await emit(event, payload);
      setLockedIn(false);
      if (isIndividual) {
        // Individual/solo mode: do NOT reveal correct/wrong yet — the backend no
        // longer sends it here on purpose. Just show the pick as "selected" and
        // wait for the 'individual-round-result' broadcast (fires once everyone
        // has answered, or when the timer expires) to actually reveal + play sound.
        setOptStates({[idx]:'selected'});
      } else {
        // Team mode: this IS the final result for the turn (one team answers per
        // round), so immediate reveal is correct here — no one else is still
        // "in progress" on this question.
        setOptStates({[idx]:res.result.correct?'correct':'wrong'});
      }
    } catch(err){ toast(err.message,'error'); setAnswered(false); setLockedIn(false); setOptStates({}); }
    setBusy(false);
  };

  const myTeamFiftyLeft = myTeam?.lifelines?.fiftyFiftyLeft ?? 3;
  const myIndPlayer     = gs.individualPlayers?.find(p => p.socketId === state.player?.socketId);
  const myIndFiftyLeft  = myIndPlayer?.fiftyFiftyLeft ?? 3;
  const fiftyFiftyLeft  = isIndividual ? myIndFiftyLeft : myTeamFiftyLeft;

  const useFiftyFifty = async () => {
    if (answered || lifelineBusy || fiftyFiftyLeft <= 0) return;
    if (!isIndividual && !isMyTurn) return;
    // Final-use warning — only when this would be their LAST available use.
    if (fiftyFiftyLeft === 1) {
      const ok = window.confirm('You have 1 use of 50/50 remaining. Use it now? This is your final use for this game.');
      if (!ok) return;
    }
    setLifelineBusy(true);
    try {
      const res = await emit('use-lifeline', { code: gs.code, teamId: myTeamId, type: 'fiftyFifty' });
      setRemovedOpts(res.removedIndices || []);
      toast(res.usesLeft > 0 ? `🎯 50/50 used — ${res.usesLeft} left!` : '🎯 50/50 used — that was your last one!', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setLifelineBusy(false);
  };

  return (
    <div className="screen" style={{background:'var(--bg)'}}>
      <div style={{padding:'12px 18px',background:'rgba(8,6,22,.92)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div className="fl fla gap2 fl1" style={{flexWrap:'wrap'}}>
          {curTeam&&<div style={{padding:'4px 10px',borderRadius:10,background:`${curTeam.color}22`,border:`1.5px solid ${curTeam.color}55`,display:'flex',alignItems:'center',gap:6}}><span>{curTeam.emoji}</span><span className="fw8 fs-sm" style={{color:curTeam.color}}>{curTeam.name}</span></div>}
          <div style={{padding:'4px 10px',borderRadius:10,background:`${meta.color}22`,border:`1.5px solid ${meta.color}44`,display:'flex',alignItems:'center',gap:5}}>
            <span style={{fontSize:'0.95rem'}}>{meta.emoji}</span><span className="fw8 fs-sm" style={{color:meta.color}}>{q.topic}</span>
          </div>
          <span className="mut fs-xs" style={{alignSelf:'center'}}>Round {gs.roundNumber||0}/{totalRnds}</span>
        </div>
        <TimerRing value={gs.timerRemaining||0} max={gs.timerSeconds||30} size={56}/>
      </div>
      <div style={{padding:'0 18px'}}><div className="progress-bar" style={{marginTop:6}}>
        <div className="progress-fill" style={{width:`${Math.round(((gs.roundNumber||0)/Math.max(1,totalRnds))*100)}%`,background:`linear-gradient(90deg,${meta.color},var(--blue2))`}}/>
      </div></div>
      {gs.doublePointsActive && (
        <div style={{margin:'10px 18px 0',padding:'8px 14px',borderRadius:12,background:'linear-gradient(135deg,rgba(255,217,61,.22),rgba(255,140,66,.22))',border:'2px solid rgba(255,217,61,.5)',textAlign:'center',fontWeight:900,color:'var(--yellow)',animation:'pulse 1.2s infinite'}}>
          ⚡ DOUBLE POINTS — this question is worth 2x! ⚡
        </div>
      )}
      {/* Comeback Catch-Up Bonus — flat bonus for whoever's in last place, final rounds only.
          Team mode: shown when the CURRENTLY ANSWERING team qualifies (visible to all, like
          double points). Individual mode: shown only to the viewing player if THEY qualify —
          other players don't need to know someone else is behind. */}
      {(isIndividual
        ? gs.comebackBonusEligiblePlayerIds?.includes(state.player?.socketId)
        : gs.comebackBonusForCurrentTeam) && (
        <div style={{margin:'10px 18px 0',padding:'8px 14px',borderRadius:12,background:'linear-gradient(135deg,rgba(76,175,80,.22),rgba(0,212,170,.18))',border:'2px solid rgba(76,175,80,.5)',textAlign:'center',fontWeight:900,color:'var(--green)',animation:'pulse 1.2s infinite'}}>
          🎯 COMEBACK BONUS — get this right for +{gs.comebackBonusPoints||125} extra pts! 🎯
        </div>
      )}
      <div style={{flex:1,padding:'14px 18px',maxWidth:720,margin:'0 auto',width:'100%'}}>
        {isIndividual ? (
          <div style={{padding:'10px 14px',borderRadius:14,marginBottom:12,display:'flex',alignItems:'center',gap:10,background:'rgba(76,175,80,.15)',border:'2px solid rgba(76,175,80,.5)',animation:!answered?'glow 2s infinite':''}}>
            <span style={{fontSize:'1.5rem'}}>{player?.avatar}</span>
            <div style={{flex:1}}>
              <div className="fw8 fs-sm" style={{color:'var(--green)'}}>{answered ? '✅ Answer submitted! Waiting for others…' : '🏅 Solo Mode — Answer now!'}</div>
              <div className="mut fs-xs mt1" style={{marginTop:3}}>{player?.name} · Individual Mode</div>
            </div>
            {answered && <span className="badge b-green">✓ Answered</span>}
          </div>
        ) : (
          <div style={{padding:'10px 14px',borderRadius:14,marginBottom:12,display:'flex',alignItems:'center',gap:10,background:isMyTurn?`${myTeam?.color}22`:`${curTeam?.color}12`,border:`2px solid ${isMyTurn?myTeam?.color+'99':curTeam?.color+'33'}`,animation:isMyTurn?'glow 2s infinite':''}}>
            <span style={{fontSize:'1.5rem'}}>{curTeam?.emoji}</span>
            <div style={{flex:1}}>
              <div className="fw8 fs-sm" style={{color:isMyTurn?myTeam?.color:curTeam?.color}}>{isMyTurn?'🎯 Your turn! Select your answer.':`Watching ${curTeam?.name} answer…`}</div>
              <div className="mut fs-xs mt1" style={{marginTop:3}}>{curTeam?.name} has answered {teamProgress(gs,gs.currentTeamId).played}/{teamProgress(gs,gs.currentTeamId).total} questions</div>
            </div>
            {curTeam?.streak >= 2 && (
              <span className="badge b-yellow" style={{fontSize:'0.8rem',animation:'pulse 1.2s infinite'}}>🔥 {curTeam.streak} streak</span>
            )}
            {!isMyTurn&&<span className="badge b-orange">👀 Watching</span>}
          </div>
        )}
        <div className="card mb3" style={{marginBottom:12,animation:'fadeUp .3s ease',borderColor:`${meta.color}44`}}>
          <div className="fl fla flb mb2">
            <span className="fs-xs fw8" style={{color:meta.color}}>{meta.emoji} {q.topic}</span>
            <div className="fl fla gap2">
              <span className={`badge diff-${q.diff}`}>{q.diff}</span>
              <span className="badge b-green fs-xs">✅ +{DIFF_PTS[q.diff]?.correct}</span>
              <span className="badge b-red fs-xs">❌ −{DIFF_PTS[q.diff]?.wrong}</span>
            </div>
          </div>
          <p style={{fontSize:'1.18rem',fontWeight:800,lineHeight:1.55}}>{q.q || q.text}</p>
          {q.mediaUrl && <QuestionMedia url={q.mediaUrl} type={q.mediaType} />}
        </div>
        {!answered && (isIndividual || isMyTurn) && (
          <div className="fl fla flb mb2" style={{marginBottom:8,flexWrap:'wrap',gap:8}}>
            <button
              className="btn btn-sm"
              disabled={fiftyFiftyLeft<=0 || lifelineBusy || removedOpts.length>0}
              onClick={useFiftyFifty}
              style={{
                background: fiftyFiftyLeft<=0 ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,var(--blue2),var(--blue))',
                opacity: fiftyFiftyLeft<=0 ? 0.5 : 1,
                cursor: fiftyFiftyLeft<=0 ? 'not-allowed' : 'pointer',
              }}
            >
              🎯 50/50 {fiftyFiftyLeft<=0 ? '— used up' : `(${fiftyFiftyLeft} left)`}
            </button>
          </div>
        )}
        <div className="opts-grid" style={{marginBottom:14,position:'relative'}}>
          {lockedIn && (
            <div style={{position:'absolute',inset:0,zIndex:5,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(8,6,22,.55)',borderRadius:16,animation:'fadeUp .2s ease'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'2.4rem',animation:'bounce .6s ease infinite'}}>🔒</div>
                <div className="fw9" style={{color:'#fff',marginTop:4}}>Locked in!</div>
              </div>
            </div>
          )}
          {q.opts.map((o,i)=>{
            const st=optStates[i];
            const isRemoved = removedOpts.includes(i);
            return (<button key={i} className={['opt-btn',st==='correct'?'opt-correct':'',st==='wrong'?'opt-wrong':'',(!canAnswer||st==='hidden'||isRemoved)?'opt-disabled':''].join(' ')}
              style={{opacity:(st==='hidden'||isRemoved)?.22:1,pointerEvents:(canAnswer&&st!=='hidden'&&!isRemoved)?'auto':'none'}} onClick={()=>submit(i)}>
              <div className="opt-letter">{LETTERS[i]}</div><span>{o}</span>
            </button>);
          })}
        </div>
        {/* Mentor sees all team scores; each student sees ONLY their own team score */}
        {state.mentor ? (
          <div className="card"><div className="sec-title">📊 Live Scores</div>
            {gs.teams?[...gs.teams].sort((a,b)=>b.score-a.score).map((t,i)=><TeamScoreRow key={t.id} team={t} rank={i+1} highlight={t.id===curTeam?.id}/>):null}
          </div>
        ) : isIndividual ? (
          /* Solo mode: show live individual leaderboard */
          <div className="card" style={{padding:'14px 16px'}}>
            <div className="sec-title" style={{margin:'0 0 8px'}}>🏅 Your Score</div>
            {(() => {
              const players = [...(state.individualPlayers || [])].sort((a,b)=>b.score-a.score);
              const me = players.find(p=>p.name===player?.name);
              return (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',borderRadius:10,background:'rgba(79,140,255,.12)',border:'1.5px solid rgba(79,140,255,.4)',marginBottom:8}}>
                    <span style={{fontSize:'1.4rem'}}>{player?.avatar||'🦁'}</span>
                    <span className="fw8 fs-sm" style={{color:'var(--blue)'}}>{player?.name} (You)</span>
                    <span style={{marginLeft:'auto',fontSize:'1.4rem',fontWeight:900,color:'var(--blue)'}}>{me?.score??0} pts</span>
                  </div>
                  {players.length > 1 && (
                    <div className="mut fs-xs" style={{textAlign:'center',marginTop:4}}>
                      {players.length} players · You're #{(players.findIndex(p=>p.name===player?.name))+1}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:'1.6rem'}}>{myTeam?.emoji}</span>
            <div>
              <div className="fw8 fs-sm" style={{color:myTeam?.color}}>{myTeam?.name}</div>
              <div className="mut fs-xs">Your score</div>
            </div>
            <div style={{marginLeft:'auto',fontSize:'1.6rem',fontWeight:900,color:myTeam?.color}}>{myTeam?.score??0} pts</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ROUND RESULT
════════════════════════════════════════════════════════════ */
export function RoundResult() {
  const { state } = useApp();
  const emit = useEmit();
  const { roundResult, gameState:gs, individualPlayers, individualAnswers } = state;
  const tm = state.topicMeta;
  const [conf,setConf] = useState(false);
  const [busy,setBusy] = useState(false);
  const [showHist,setShowHist] = useState(false);
  const [revealed,setRevealed] = useState(false); // suspense delay before showing points/score
  const isMentor = !!state.mentor;

  const isIndividualMode = roundResult?.mode === 'individual' || state.player?.mode === 'individual';

  useEffect(()=>{
    const myAnswerForSound = individualAnswers?.[state.player?.socketId]
      || Object.values(individualAnswers||{}).find(a=>a.playerName===state.player?.name);
    const correct = isIndividualMode ? (myAnswerForSound?.correct || false) : roundResult?.result?.correct;
    const revealTimer = setTimeout(() => {
      setRevealed(true);
      if(correct){setConf(true);playCorrect();const t=setTimeout(()=>setConf(false),2500);}
      else{playWrong();}
    }, 1500);
    return () => clearTimeout(revealTimer);
  },[]);// eslint-disable-line

  if (!roundResult||!gs) return <div className="screen" style={{alignItems:'center',justifyContent:'center'}}><p className="mut fw8">Loading…</p></div>;

  // === INDIVIDUAL MODE ROUND RESULT ===
  if (isIndividualMode) {
    const { summary, timedOut } = roundResult;
    const myAnswer = individualAnswers?.[state.player?.socketId] || Object.values(individualAnswers||{}).find(a=>a.playerName===state.player?.name);
    const myCorrect = myAnswer?.correct || false;
    const myChange  = myAnswer?.totalChange || 0;
    const myScore   = myAnswer?.newScore ?? (individualPlayers||[]).find(p=>p.name===state.player?.name)?.score ?? 0;
    const leaderboard = [...(summary?.leaderboard || individualPlayers || [])].sort((a,b)=>b.score-a.score);
    const playerResults = summary?.playerResults || [];
    const handleNextInd = async () => {
      if (!isMentor) return; setBusy(true);
      try { await emit('next-round',{code:gs.code}); } catch(_){}
      setBusy(false);
    };
    return (
      <div className="screen" style={{padding:20}}>
        <Confetti active={conf}/>
        <div style={{maxWidth:700,margin:'0 auto',width:'100%'}}>
          {/* My result */}
          {!isMentor && (
            <div className="card tc mb3" style={{padding:'22px 20px',marginBottom:14,
              borderColor:myCorrect?'rgba(76,175,80,.4)':timedOut&&!myAnswer?'rgba(255,217,61,.3)':'rgba(255,82,82,.3)',animation:'popIn .35s ease'}}>
              <div style={{fontSize:'3rem',marginBottom:8}}>{myCorrect?'🎉':timedOut&&!myAnswer?'⏰':'😮'}</div>
              <h2 style={{fontSize:'1.5rem',marginBottom:8,color:myCorrect?'var(--green)':timedOut&&!myAnswer?'var(--yellow)':'var(--red)'}}>
                {myCorrect?'Correct! 🎯':timedOut&&!myAnswer?"Time's Up!":"Wrong Answer!"}
              </h2>
              <div style={{fontSize:'2.2rem',fontWeight:900,marginBottom:12,color:myChange>0?'var(--green)':myChange<0?'var(--red)':'var(--t2)'}}>
                {myChange>0?'+':''}{myChange} pts
              </div>
              <div style={{padding:'10px 14px',borderRadius:12,background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)',marginBottom:8,textAlign:'left'}}>
                <span className="grn fw8 fs-sm">✅ Correct: {summary?.correctAns}</span>
              </div>
              {summary?.explanation&&<div style={{background:'var(--bg2)',borderLeft:'4px solid var(--blue2)',borderRadius:'0 12px 12px 0',padding:'10px 14px',textAlign:'left',fontSize:'0.92rem',color:'var(--t2)',lineHeight:1.6,marginTop:8}}>💡 {summary.explanation}</div>}
              <MentorReaction correct={myCorrect} />
              <div style={{marginTop:12,padding:'8px 14px',borderRadius:10,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)'}}>
                <span className="fw8 fs-sm">Your total: <span style={{color:'var(--blue)',fontSize:'1.2rem'}}>{myScore} pts</span></span>
              </div>
            </div>
          )}
          {/* Leaderboard */}
          <div className="card mb3" style={{marginBottom:14}}>
            <div className="sec-title">🏆 Live Leaderboard ({leaderboard.length} players)</div>
            {leaderboard.map((p,i)=>(
              <div key={p.socketId||p.name||i} style={{
                display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,marginBottom:6,
                background: p.name===state.player?.name && !isMentor ? 'rgba(79,140,255,.12)' : `rgba(255,255,255,.04)`,
                border:`1.5px solid ${p.name===state.player?.name && !isMentor ? 'rgba(79,140,255,.4)' : 'rgba(255,255,255,.08)'}`,
              }}>
                <span style={{fontSize:'1.2rem',minWidth:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                <span style={{fontSize:'1.3rem'}}>{p.avatar||'🦁'}</span>
                <span className="fw8 fs-sm fl1" style={{color:p.name===state.player?.name&&!isMentor?'var(--blue)':'var(--t1)'}}>{p.name}{p.name===state.player?.name&&!isMentor?' (You)':''}</span>
                {/* Show answer status */}
                {isMentor && playerResults.length>0 && (() => {
                  const pr = playerResults.find(r=>r.name===p.name);
                  return pr ? <span className={`badge ${pr.correct?'b-green':'b-red'}`} style={{fontSize:'0.75rem'}}>{pr.correct?`✅ +${pr.totalChange}`:`❌ ${pr.totalChange}`}</span> : null;
                })()}
                <span style={{fontSize:'1.2rem',fontWeight:900,color:'var(--blue)'}}>{p.score} pts</span>
              </div>
            ))}
          </div>
          {/* Question summary */}
          {summary?.question && (
            <div className="card mb3" style={{marginBottom:14}}>
              <div className="sec-title">📋 This Round</div>
              <div style={{background:'var(--bg3)',borderRadius:12,padding:'10px 14px',marginBottom:8,fontSize:'0.95rem'}}>{summary.question}</div>
              <div style={{background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)',borderRadius:10,padding:'8px 12px'}}>
                <span className="grn fw8 fs-sm">✅ {summary.correctAns}</span>
              </div>
              {summary.explanation&&<div style={{marginTop:8,padding:'8px 12px',borderRadius:10,background:'var(--bg2)',borderLeft:'3px solid var(--blue2)',fontSize:'0.9rem',color:'var(--t2)'}}>💡 {summary.explanation}</div>}
            </div>
          )}
          {isMentor ? (
            <button className="btn btn-primary btn-block btn-lg" onClick={handleNextInd} disabled={busy}>
              {busy?'⏳':gs.availableTopics?.length===0?'🏁 Final Results':'➡️ Next Round'}
            </button>
          ) : (
            <div style={{textAlign:'center',padding:'14px 20px',background:'var(--c1)',borderRadius:14,color:'var(--t2)',fontSize:'0.95rem',fontWeight:700}}>⏳ Waiting for mentor to continue…</div>
          )}
        </div>
      </div>
    );
  }

  const { summary, timedOut } = roundResult;
  const myTeamId   = state.player?.teamId;
  const correct    = roundResult.result?.correct||false;
  const totalChange= summary?.totalChange??0;
  const isMyTeam   = summary?.teamId===myTeamId;
  const meta       = tm[summary?.topic]||{emoji:'🎯',color:'var(--blue)'};
  const teamColor  = gs.teams?.find(t=>t.id===summary?.teamId)?.color||'var(--blue)';
  const teamEmoji  = gs.teams?.find(t=>t.id===summary?.teamId)?.emoji||'👥';
  const nextTeam   = gs.teams?.[gs.currentTeamIdx];
  const available  = gs.availableTopics||[];
  const _isIndRound = gs.mode === 'individual';
  const totalRnds  = _isIndRound
    ? (gs.questionsPerTeam || 5)
    : (gs.questionsPerTeam || 10) * (gs.teams?.length || 1);
  const history    = gs.roundHistory||[];

  const handleNext = async () => {
    if (!isMentor) return; setBusy(true);
    try { await emit('next-round',{code:gs.code}); } catch(_){}
    setBusy(false);
  };

  return (
    <div className="screen" style={{padding:20,minHeight:'100vh'}}>
      <Confetti active={conf}/>
      <div style={{marginBottom:14}}>
        <div className="fl fla flb mb1" style={{marginBottom:5}}><span className="mut fs-xs">Progress</span><span className="mut fs-xs">Round {gs.roundNumber||0} / {totalRnds}</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{width:`${Math.round(((gs.roundNumber||0)/Math.max(1,totalRnds))*100)}%`,background:'linear-gradient(90deg,var(--blue),var(--blue2))'}}/></div>
      </div>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%'}}>
        {!revealed ? (
          <div className="card tc" style={{padding:'40px 20px',animation:'popIn .3s ease'}}>
            <div style={{fontSize:'3rem',marginBottom:14,animation:'pulse 1s infinite'}}>🤔</div>
            <div className="fw8" style={{fontSize:'1.1rem',color:'var(--t2)'}}>Calculating result…</div>
          </div>
        ) : (
        <div className="card tc mb3" style={{marginBottom:14,animation:'popIn .35s ease',padding:'22px 20px',borderColor:correct?'rgba(76,175,80,.4)':timedOut?'rgba(255,217,61,.3)':'rgba(255,82,82,.3)'}}>
          <div style={{fontSize:'3.5rem',marginBottom:10}}>{timedOut?'⏰':correct?'🎉':'😮'}</div>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:`${teamColor}22`,border:`1.5px solid ${teamColor}55`,marginBottom:12}}>
            <span style={{fontSize:'1.3rem'}}>{teamEmoji}</span><span className="fw8" style={{color:teamColor}}>{summary?.teamName}</span>
          </div>
          <h2 style={{fontSize:'1.5rem',marginBottom:8,color:correct?'var(--green)':timedOut?'var(--yellow)':'var(--red)'}}>{timedOut?"Time's Up!":correct?'Correct! 🎯':'Wrong Answer!'}</h2>
          <div style={{fontSize:'2.2rem',fontWeight:900,marginBottom:12,color:totalChange>0?'var(--green)':totalChange<0?'var(--red)':'var(--t2)'}}>
            {totalChange>0?'+':''}{totalChange} pts
            {correct&&roundResult.result?.speedBonus>0&&<span className="badge b-yellow" style={{fontSize:'0.8rem',marginLeft:8,verticalAlign:'middle'}}>⚡ +{roundResult.result.speedBonus}</span>}
            {correct&&roundResult.result?.streakMultiplier>1&&<span className="badge b-yellow" style={{fontSize:'0.8rem',marginLeft:8,verticalAlign:'middle'}}>🔥 x{roundResult.result.streakMultiplier} streak</span>}
            {roundResult.result?.doublePoints&&<span className="badge b-purple" style={{fontSize:'0.8rem',marginLeft:8,verticalAlign:'middle'}}>⚡ 2x double points</span>}
            {roundResult.result?.comebackBonus&&<span className="badge b-green" style={{fontSize:'0.8rem',marginLeft:8,verticalAlign:'middle'}}>🎯 +{roundResult.result?.comebackBonusPoints||125} comeback bonus</span>}
          </div>
          <div className="fl fla flc gap2 mb3" style={{justifyContent:'center',marginBottom:12}}>
            <span style={{padding:'4px 10px',borderRadius:20,background:`${meta.color}22`,border:`1.5px solid ${meta.color}44`,fontSize:'0.88rem',fontWeight:700,color:meta.color}}>{meta.emoji} {summary?.topic}</span>
            <span className={`badge diff-${summary?.diff}`}>{summary?.diff}</span>
          </div>
          <div style={{background:'var(--bg3)',borderRadius:12,padding:'12px 16px',marginBottom:12,textAlign:'left'}}>
            <div className="mut fs-xs fw8 mb1" style={{marginBottom:5}}>QUESTION</div><div className="fw8 fs-sm">{summary?.question}</div>
          </div>
          <div style={{background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)',borderRadius:12,padding:'10px 14px',textAlign:'left',marginBottom:summary?.explanation?8:0}}>
            <span className="grn fw8 fs-sm">✅ Correct: {summary?.correctAns}</span>
          </div>
          {summary?.explanation&&<div style={{background:'var(--bg2)',border:'1px solid rgba(123,97,255,.2)',borderLeft:'4px solid var(--blue2)',borderRadius:'0 12px 12px 0',padding:'10px 14px',textAlign:'left',marginTop:8,fontSize:'0.92rem',color:'var(--t2)',lineHeight:1.6}}>💡 {summary.explanation}</div>}
          <MentorReaction correct={correct} />
          {isMyTeam&&<div style={{marginTop:12,padding:'10px 14px',borderRadius:12,background:correct?'rgba(76,175,80,.08)':'rgba(255,82,82,.08)',border:`1px solid ${correct?'rgba(76,175,80,.3)':'rgba(255,82,82,.3)'}`}}>
            <span className="fw8 fs-sm" style={{color:correct?'var(--green)':'var(--red)'}}>{correct?`🏆 Your team scored! Total: ${summary?.totalScore} pts`:timedOut?`⏰ Timed out — ${totalChange} pts. Total: ${summary?.totalScore}`:`❌ Wrong — ${totalChange} pts. Total: ${summary?.totalScore}`}</span>
          </div>}
        </div>
        )}
        {/* Standings card — mentor always sees all; students see only their team mid-game.
            Hidden until `revealed` so the freeze/suspense delay above isn't undermined by
            an already-visible updated score. */}
        {!revealed ? null : isMentor ? (
          <div className="card mb3" style={{marginBottom:14}}>
            <div className="sec-title">🏆 All Team Scores</div>
            {(summary?.teams||gs.teams)?[...(summary?.teams||gs.teams)].sort((a,b)=>b.score-a.score).map((t,i)=><TeamScoreRow key={t.id} team={t} rank={i+1} animate/>):null}
          </div>
        ) : (
          /* Student: show only their own team's current score during mid-game round result */
          (() => {
            const myTeamData = (summary?.teams||gs.teams)?.find(t=>t.id===myTeamId);
            if (!myTeamData) return null;
            return (
              <div className="card mb3" style={{marginBottom:14,padding:'14px 16px'}}>
                <div className="sec-title" style={{margin:'0 0 8px'}}>🏅 Your Score</div>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:'1.8rem'}}>{myTeamData.emoji}</span>
                  <div>
                    <div className="fw8" style={{color:myTeamData.color}}>{myTeamData.name}</div>
                    <div className="mut fs-xs">{isMyTeam ? 'Your team just played' : 'Watching this round'}</div>
                  </div>
                  <div style={{marginLeft:'auto',fontSize:'1.8rem',fontWeight:900,color:myTeamData.color}}>{myTeamData.score} pts</div>
                </div>
              </div>
            );
          })()
        )}
        <div className="card mb3" style={{marginBottom:14}}><div className="sec-title">📋 Questions Per Team</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
            {gs.teams?.map(t=>{ const p=teamProgress(gs,t.id); return (
              <div key={t.id} style={{padding:'10px 12px',borderRadius:12,background:`${t.color}15`,border:`1.5px solid ${t.color}44`}}>
                <div className="fl fla flb mb1" style={{marginBottom:5}}><span style={{fontSize:'0.9rem',fontWeight:800,color:t.color}}>{t.emoji} {t.name}</span><span className="fs-xs mut">{p.played}/{p.total}</span></div>
                <div className="progress-bar" style={{height:5}}><div className="progress-fill" style={{width:`${p.pct}%`,background:t.color}}/></div>
              </div>
            );})}
          </div>
        </div>
        {history.length>1&&<div className="card mb3" style={{marginBottom:14}}>
          <div className="fl fla flb" onClick={()=>setShowHist(h=>!h)} style={{cursor:'pointer'}}>
            <div className="sec-title" style={{margin:0}}>📜 History ({history.length})</div>
            <span className="mut fs-sm">{showHist?'▲ Hide':'▼ Show'}</span>
          </div>
          {showHist&&<div style={{marginTop:12}}>{[...history].reverse().map((r,i)=>{
            const td=gs.teams?.find(t=>t.id===r.teamId);
            return(<div key={i} className="fl fla gap2" style={{padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,.05)',flexWrap:'wrap'}}>
              <span className="mut fs-xs fw8" style={{minWidth:28}}>#{history.length-i}</span>
              <span style={{fontSize:'1.05rem'}}>{td?.emoji}</span>
              <span className="fw8 fs-xs fl1" style={{color:td?.color}}>{td?.name}</span>
              <span style={{padding:'2px 6px',borderRadius:6,background:`${tColor(r.topic,tm)}22`,color:tColor(r.topic,tm),fontSize:'0.82rem',fontWeight:700}}>{tEmoji(r.topic,tm)} {r.topic}</span>
              <span className={`badge diff-${r.diff}`} style={{fontSize:'0.75rem'}}>{r.diff}</span>
              <span className="fw8 fs-xs" style={{color:r.correct?'var(--green)':r.timedOut?'var(--yellow)':'var(--red)',minWidth:50,textAlign:'right'}}>{r.totalChange>0?'+':''}{r.totalChange}{r.timedOut?'⏰':r.correct?'✅':'❌'}</span>
            </div>);
          })}</div>}
        </div>}
        {nextTeam&&available.length>0&&!gs.gameOver&&<div style={{padding:'10px 16px',borderRadius:14,marginBottom:14,background:`${nextTeam.color}18`,border:`1.5px solid ${nextTeam.color}44`,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:'1.5rem'}}>{nextTeam.emoji}</span>
          <span className="fw8 fs-sm" style={{color:nextTeam.color}}>Next: <strong>{nextTeam.name}</strong> picks a topic ({available.length} left)</span>
        </div>}
        {timedOut && !isMentor && (
          <div style={{padding:'12px 16px',borderRadius:14,marginBottom:14,background:'rgba(255,217,61,.08)',border:'1.5px solid rgba(255,217,61,.35)',textAlign:'center'}}>
            <div style={{fontSize:'1.5rem',marginBottom:6}}>⏰</div>
            <div className="fw8 fs-sm" style={{color:'var(--yellow)',marginBottom:4}}>Time ran out!</div>
            <div className="mut fs-sm">Your mentor will guide you through the correct answer. Points have been deducted.</div>
          </div>
        )}
        {isMentor?(
          <button
            className={`btn btn-block btn-lg ${gs.gameOver ? 'btn-green' : 'btn-primary'}`}
            onClick={handleNext}
            disabled={busy}
            style={gs.gameOver ? {background:'linear-gradient(135deg,#4CAF50,#00D4AA)',border:'none'} : {}}
          >
            {busy ? '⏳' : gs.gameOver ? '🏁 Show Final Results' : `➡️ Let ${nextTeam?.name||'next team'} Pick`}
          </button>
        ):(
          <div style={{textAlign:'center',padding:'14px 20px',background:'var(--c1)',borderRadius:14,color:'var(--t2)',fontSize:'0.95rem',fontWeight:700}}>⏳ Waiting for mentor to continue…</div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SHARED GAME SCREEN  — single device, teams take turns
   No sockets needed — mentor runs this locally
════════════════════════════════════════════════════════════ */
const FEEDBACK_EMOJIS_CORRECT = ['🎉','✅','🏆','⭐','🌟','💥','🔥','👏','🎯','💪'];
const FEEDBACK_EMOJIS_WRONG   = ['❌','😮','💀','😬','🙈','😱','💔','🤦','😤','❗'];

export function SharedGameScreen() {
  const { state, toast: sharedToast } = useApp();
  const tm = state.topicMeta;

  // ── STATE ──────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('setup');
  const [teamCount,    setTeamCount]    = useState(2);
  const [qPerTeam,     setQPerTeam]     = useState(5);
  const [timerSecs,    setTimerSecs]    = useState(30);
  const [teams,        setTeams]        = useState(() => TEAM_PRESETS.slice(0,2).map(t=>({...t,score:0})));
  const [curTeamIdx,   setCurTeamIdx]   = useState(0);
  const [available,    setAvailable]    = useState({}); // { topic: { easy:[], medium:[], hard:[] } }
  const [question,     setQuestion]     = useState(null);
  const [chosenTopic,  setChosenTopic]  = useState(null);
  const [chosenDiff,   setChosenDiff]   = useState(null);
  const [timer,        setTimer]        = useState(30);
  const [timerActive,  setTimerActive]  = useState(false);
  const [rounds,       setRounds]       = useState([]);
  const [teamRounds,   setTeamRounds]   = useState({});
  const [feedback,     setFeedback]     = useState(null);
  const [answeredIdx,  setAnsweredIdx]  = useState(null);
  const [usedIds,      setUsedIds]      = useState([]);
  const [dbQ,          setDbQ]          = useState([]);
  const [loadingQ,     setLoadingQ]     = useState(true);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState({}); // { teamId: count } — 50/50 lifeline, resets per game
  const [removedOpts,    setRemovedOpts]   = useState([]);  // indices hidden by 50/50 on the CURRENT question

  // Full reset for "Play Again" — the component stays mounted between games
  // (we just flip `phase` back to 'setup'), so anything left in state here
  // would otherwise leak into the next game: previous scores, used questions,
  // round history, and 50/50 lifeline usage all need to go back to zero.
  // This was the root cause of "category still shows all used in a new game"
  // for Shared Screen mode specifically.
  const resetSharedGame = () => {
    setTeams(t => t.map(x => ({ ...x, score: 0 })));
    setCurTeamIdx(0);
    setQuestion(null);
    setChosenTopic(null);
    setChosenDiff(null);
    setTimer(timerSecs);
    setTimerActive(false);
    setRounds([]);
    setTeamRounds({});
    setFeedback(null);
    setAnsweredIdx(null);
    setUsedIds([]);
    setFiftyFiftyUsed({});
    setRemovedOpts([]);
    setPhase('setup');
  };

  // Load questions
  useEffect(() => {
    api.getQuestions()
      .then(r => { setDbQ(r.questions || []); setLoadingQ(false); })
      .catch(() => setLoadingQ(false));
  }, []);

  // Sound feedback whenever a new round result comes in
  useEffect(() => {
    if (!feedback) return;
    if (feedback.correct) playCorrect(); else playWrong();
  }, [feedback]);

  // ── TIMER ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || timer <= 0) return;
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timerActive, timer]);

  // Check timeout every render (avoids stale closure issues)
  const prevTimerRef = React.useRef(timer);
  useEffect(() => {
    if (timerActive && timer === 0 && prevTimerRef.current !== 0 && phase === 'question' && answeredIdx === null) {
      setTimerActive(false);
      const diff    = question?.diff || 'easy';
      const penalty = DIFF_PTS[diff].wrong;
      const ct      = teams[curTeamIdx];
      setTeams(p => p.map(t => t.id === ct.id ? { ...t, score: Math.max(0, t.score - penalty) } : t));
      const entry = { teamId:ct.id, teamName:ct.name, topic:chosenTopic, diff, correct:false, timedOut:true, totalChange:-penalty, question:question?.q||'', correctAns:question?.opts[question?.ans[0]]||'' };
      setRounds(p => [...p, entry]);
      setTeamRounds(p => ({...p, [ct.id]:(p[ct.id]||0)+1}));
      setFeedback({ correct:false, change:-penalty, emoji1:'⏰', emoji2:'😱', timedOut:true, teamColor:ct.color, teamEmoji:ct.emoji, teamName:ct.name, correctAns:question?.opts[question?.ans[0]]||'', explanation:question?.exp||'' });
      setAnsweredIdx(-1);
      setPhase('feedback');
      // Toast notification for time up
      if (typeof sharedToast === 'function') sharedToast("⏰ Time's Up! " + ct.name + " missed the question. −" + penalty + " pts", 'error');
    }
    prevTimerRef.current = timer;
  });

  // Save result to localStorage when game finishes (must be here — before all early returns)
  React.useEffect(() => {
    if (phase === 'finished' && rounds.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem('quizquest_shared_results') || '[]');
        const newResult = {
          title: `Shared Game — ${new Date().toLocaleDateString()}`,
          date: Date.now(),
          teams: teams.map(t => ({...t})),
          rounds: rounds.map(r => ({...r})),
        };
        const alreadySaved = existing.some(r => Math.abs(r.date - newResult.date) < 5000);
        if (!alreadySaved) {
          localStorage.setItem('quizquest_shared_results', JSON.stringify([newResult, ...existing].slice(0, 20)));
        }
      } catch(_) {}
    }
  }, [phase]); // eslint-disable-line

  // ── HELPERS ────────────────────────────────────────────────────────────
  const handleTeamCount = n => {
    setTeamCount(n);
    setTeams(TEAM_PRESETS.slice(0, n).map(t => ({...t, score:0})));
  };

  const updateTeamName = (i, name) =>
    setTeams(p => p.map((t, ti) => ti===i ? {...t, name} : t));

  // Build available pool grouped by topic → difficulty
  const startGame = () => {
    const pool = {};
    dbQ.forEach(q => {
      if (!pool[q.topic]) pool[q.topic] = { easy:[], medium:[], hard:[] };
      if (pool[q.topic][q.diff]) pool[q.topic][q.diff].push(q);
    });
    // Keep only topics with ≥3 total questions (at least 1 per difficulty level helps too)
    const eligible = {};
    Object.entries(pool).forEach(([topic, byDiff]) => {
      const total = (byDiff.easy?.length||0) + (byDiff.medium?.length||0) + (byDiff.hard?.length||0);
      if (total >= 3) eligible[topic] = byDiff;
    });
    if (Object.keys(eligible).length === 0) {
      alert('No topics with ≥3 questions! Add questions via the mentor Quiz Builder first.');
      return;
    }
    setAvailable(eligible);
    setTeams(p => p.slice(0, teamCount).map(t => ({...t, score:0})));
    setTeamRounds({}); setRounds([]); setUsedIds([]);
    setCurTeamIdx(0); setFeedback(null); setQuestion(null);
    setAnsweredIdx(null); setChosenTopic(null); setChosenDiff(null);
    setPhase('topic_pick');
  };

  // Step 1: team picks topic
  const pickTopic = topic => {
    setChosenTopic(topic);
    setPhase('diff_pick'); // new phase: mentor picks difficulty
  };

  // Step 2: mentor picks difficulty → load question
  const pickDifficulty = diff => {
    const topicPool = available[chosenTopic]?.[diff] || [];
    const unused    = topicPool.filter(q => !usedIds.includes(q.id));
    // fallback: if chosen diff has no unused, try other diffs
    let pool = unused;
    if (pool.length === 0) {
      const allDiffs = ['easy','medium','hard'];
      for (const d of allDiffs) {
        const alt = (available[chosenTopic]?.[d] || []).filter(q => !usedIds.includes(q.id));
        if (alt.length > 0) { pool = alt; break; }
      }
    }
    if (pool.length === 0) {
      // Topic exhausted — remove it
      setAvailable(p => { const n={...p}; delete n[chosenTopic]; return n; });
      setPhase('topic_pick');
      return;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    setQuestion(q);
    setChosenDiff(q.diff);
    setUsedIds(p => [...p, q.id]);
    setAnsweredIdx(null); setFeedback(null); setRemovedOpts([]);
    setTimer(timerSecs); setTimerActive(true);
    setPhase('question');
    // Check if topic is fully exhausted
    const remaining = Object.values(available[chosenTopic]||{}).flat().filter(qq => qq.id !== q.id && !usedIds.includes(qq.id));
    if (remaining.length === 0) {
      setAvailable(p => { const n={...p}; delete n[chosenTopic]; return n; });
    }
  };

  const SHARED_FIFTY_FIFTY_MAX = 3;
  const useFiftyFiftyShared = () => {
    if (answeredIdx !== null || phase !== 'question' || timer <= 0) return;
    const ct = teams[curTeamIdx];
    const usesSoFar = fiftyFiftyUsed[ct.id] || 0;
    if (usesSoFar >= SHARED_FIFTY_FIFTY_MAX) return;
    if (usesSoFar === SHARED_FIFTY_FIFTY_MAX - 1) {
      const ok = window.confirm(`${ct.name} has 1 use of 50/50 remaining. Use it now? This is the final use for this game.`);
      if (!ok) return;
    }
    const wrongIndices = question.opts.map((_,i)=>i).filter(i => !question.ans.includes(i));
    if (wrongIndices.length < 2) return;
    const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
    const removed = shuffled.slice(0, shuffled.length - 1);
    setRemovedOpts(removed);
    setFiftyFiftyUsed(p => ({ ...p, [ct.id]: usesSoFar + 1 }));
    const left = SHARED_FIFTY_FIFTY_MAX - (usesSoFar + 1);
    sharedToast(left > 0 ? `🎯 50/50 used — ${left} left for ${ct.name}!` : `🎯 50/50 used — that was ${ct.name}'s last one!`, 'success');
  };

  // Comeback Catch-Up Bonus — same design as team/solo mode: flat bonus for
  // whoever's in last place, only during the final 3 rounds, only on correct.
  const SHARED_COMEBACK_BONUS_POINTS       = 125;
  const SHARED_COMEBACK_BONUS_FINAL_ROUNDS = 3;
  const sharedTotalRounds  = qPerTeam * teamCount;
  const sharedRoundInProgress = rounds.length + 1;
  const sharedIsFinalStretch  = sharedRoundInProgress > sharedTotalRounds - SHARED_COMEBACK_BONUS_FINAL_ROUNDS;
  const sharedLowestScore     = teams.length ? Math.min(...teams.map(t=>t.score)) : 0;
  const sharedComebackEligibleTeamIds = sharedIsFinalStretch
    ? teams.filter(t=>t.score===sharedLowestScore).map(t=>t.id)
    : [];

  const submitAnswer = idx => {
    if (answeredIdx !== null || phase !== 'question') return;
    setTimerActive(false);
    setAnsweredIdx(idx);
    const correct = question.ans.includes(idx);
    const diff    = question.diff;
    const ct = teams[curTeamIdx];
    const speedBonus = correct ? Math.floor((timer/timerSecs)*DIFF_PTS[diff].correct*0.5) : 0;
    const comebackBonus = correct && sharedComebackEligibleTeamIds.includes(ct.id) ? SHARED_COMEBACK_BONUS_POINTS : 0;
    const totalChange = (correct ? DIFF_PTS[diff].correct + speedBonus : -DIFF_PTS[diff].wrong) + comebackBonus;
    setTeams(p => p.map(t => t.id===ct.id ? {...t,score:Math.max(0,t.score+totalChange)} : t));
    setRounds(p => [...p,{teamId:ct.id,teamName:ct.name,topic:chosenTopic,diff,correct,totalChange,comebackBonus:comebackBonus>0,question:question.q,correctAns:question.opts[question.ans[0]]}]);
    setTeamRounds(p => ({...p,[ct.id]:(p[ct.id]||0)+1}));
    const ei = Math.floor(Math.random()*FEEDBACK_EMOJIS_CORRECT.length);
    setFeedback({correct,change:totalChange,
      emoji1:correct?FEEDBACK_EMOJIS_CORRECT[ei]:FEEDBACK_EMOJIS_WRONG[ei],
      emoji2:correct?FEEDBACK_EMOJIS_CORRECT[(ei+1)%10]:FEEDBACK_EMOJIS_WRONG[(ei+1)%10],
      timedOut:false,teamColor:ct.color,teamEmoji:ct.emoji,teamName:ct.name,
      correctAns:question.opts[question.ans[0]],explanation:question.exp||'',speedBonus:correct?speedBonus:0,
      comebackBonus:comebackBonus>0,comebackBonusPoints:SHARED_COMEBACK_BONUS_POINTS});
    setPhase('feedback');
  };

  const nextTurn = () => {
    const isLast = rounds.length >= qPerTeam*teamCount || Object.keys(available).length===0;
    setFeedback(null); setQuestion(null); setAnsweredIdx(null);
    setChosenTopic(null); setChosenDiff(null);
    if (isLast) { setPhase('finished'); return; }
    setCurTeamIdx(prev => (prev+1)%teamCount);
    setPhase('topic_pick');
  };

  // ── DERIVED ────────────────────────────────────────────────────────────
  const ct        = teams[curTeamIdx] || teams[0];
  const totalRnds = qPerTeam * teamCount;
  const played    = rounds.length;
  const avTopics  = Object.keys(available);

  // Difficulty counts for a given topic (how many unused questions exist per diff)
  const diffCounts = topic => {
    if (!topic || !available[topic]) return {easy:0,medium:0,hard:0};
    return {
      easy:   (available[topic].easy||[]).filter(q=>!usedIds.includes(q.id)).length,
      medium: (available[topic].medium||[]).filter(q=>!usedIds.includes(q.id)).length,
      hard:   (available[topic].hard||[]).filter(q=>!usedIds.includes(q.id)).length,
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  // SETUP
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'setup') return (
    <div className="screen" style={{alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{maxWidth:600,width:'100%'}}>
        <h2 style={{fontSize:'1.5rem',marginBottom:12}}>🖥️ Shared Screen Mode</h2>
        <div style={{padding:'10px 16px',borderRadius:12,background:'rgba(79,140,255,.08)',border:'1px solid rgba(79,140,255,.2)',marginBottom:18,fontSize:'0.92rem',color:'var(--blue)'}}>
          {loadingQ ? '⏳ Loading questions…' : `✅ ${dbQ.length} questions ready. All teams play on one screen. No phones needed!`}
        </div>
        <div className="card mb3" style={{marginBottom:14}}>
          <div className="sec-title">⚙️ Settings</div>
          <div className="fg"><label className="lbl">Teams</label>
            <div className="fl gap2 flw">{[2,3,4,5,6].map(n=>(
              <button key={n} onClick={()=>handleTeamCount(n)} className="btn btn-sm"
                style={{flex:1,background:teamCount===n?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${teamCount===n?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:teamCount===n?'#fff':'var(--t2)'}}>
                {n} Teams
              </button>
            ))}</div>
          </div>
          <div className="fg"><label className="lbl">Questions Per Team</label>
            <div className="fl gap2">{[3,5,8,10].map(n=>(
              <button key={n} onClick={()=>setQPerTeam(n)} className="btn btn-sm"
                style={{flex:1,background:qPerTeam===n?'var(--blue)':'var(--bg3)',border:`1.5px solid ${qPerTeam===n?'var(--blue)':'rgba(255,255,255,.1)'}`,color:qPerTeam===n?'#fff':'var(--t2)'}}>
                {n}
              </button>
            ))}</div>
          </div>
          <div className="fg"><label className="lbl">Timer: <strong>{timerSecs}s</strong></label>
            <input type="range" min={10} max={60} step={5} value={timerSecs} onChange={e=>setTimerSecs(+e.target.value)} style={{width:'100%',marginTop:8,accentColor:'var(--blue)'}}/>
          </div>
        </div>
        <div className="card mb3" style={{marginBottom:14}}>
          <div className="sec-title">👥 Team Names</div>
          {teams.map((tp,i)=>(
            <div key={tp.id} className="fl fla gap2" style={{marginBottom:9}}>
              <span style={{width:36,height:36,borderRadius:'50%',background:`${tp.color}22`,border:`1.5px solid ${tp.color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.15rem',flexShrink:0}}>{tp.emoji}</span>
              <input className="inp fl1" value={tp.name} placeholder={`Team ${tp.id}`} onChange={e=>updateTeamName(i,e.target.value)}/>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={startGame} disabled={loadingQ||dbQ.length===0}>
          {loadingQ?'⏳ Loading…':'🚀 Start Shared Game'}
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // TOPIC PICK (team picks)
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'topic_pick') return (
    <div className="screen">
      <div style={{padding:'12px 18px',background:'rgba(8,6,22,.9)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{padding:'5px 14px',borderRadius:12,background:`${ct.color}22`,border:`1.5px solid ${ct.color}66`,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:'1.4rem'}}>{ct.emoji}</span>
          <span className="fw8 fs-lg" style={{color:ct.color}}>{ct.name}'s Turn</span>
        </div>
        <span className="mut fs-xs">Round {played+1}/{totalRnds}</span>
      </div>
      <div style={{padding:'0 18px'}}><div className="progress-bar" style={{marginTop:6}}>
        <div className="progress-fill" style={{width:`${Math.round((played/Math.max(1,totalRnds))*100)}%`,background:`linear-gradient(90deg,${ct.color},var(--blue2))`}}/>
      </div></div>
      <div style={{flex:1,padding:'16px 18px',maxWidth:900,margin:'0 auto',width:'100%'}}>
        {/* Team banner */}
        <div style={{padding:'20px 22px',borderRadius:20,marginBottom:20,background:`${ct.color}22`,border:`3px solid ${ct.color}88`,animation:'glow 2.5s infinite',textAlign:'center'}}>
          <div style={{fontSize:'3rem',marginBottom:6}}>{ct.emoji}</div>
          <div style={{fontSize:'1.5rem',fontWeight:900,color:ct.color,marginBottom:4}}>{ct.name}</div>
          <div className="fw8 fs-sm" style={{color:ct.color}}>Pick a topic to get your question!</div>
          <div className="mut fs-xs mt1" style={{marginTop:6}}>Your score: <strong style={{color:ct.color}}>{ct.score} pts</strong> · {teamRounds[ct.id]||0}/{qPerTeam} done</div>
        </div>
        {/* Topic grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:14,marginBottom:20}}>
          {Object.entries(tm).map(([name,meta])=>{
            const avail=avTopics.includes(name);
            const dc=diffCounts(name);
            return(
              <button key={name} onClick={()=>avail&&pickTopic(name)} disabled={!avail}
                style={{borderRadius:18,padding:'20px 14px',textAlign:'center',cursor:avail?'pointer':'default',background:avail?`${meta.color}22`:'rgba(255,255,255,.03)',border:`2px solid ${avail?meta.color+'77':'rgba(255,255,255,.06)'}`,opacity:avail?1:.3,transition:'.22s',color:'inherit'}}
                onMouseEnter={e=>{if(avail){e.currentTarget.style.transform='translateY(-6px) scale(1.04)';e.currentTarget.style.boxShadow=`0 14px 36px ${meta.color}55`;}}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                <div style={{fontSize:'2.4rem',marginBottom:8}}>{meta.emoji}</div>
                <div className="fw8" style={{color:avail?meta.color:'var(--t3)',fontSize:'1.05rem',marginBottom:6}}>{name}</div>
                {avail && (
                  <div className="fl fla flc gap1" style={{justifyContent:'center',flexWrap:'wrap'}}>
                    {dc.easy>0   && <span style={{fontSize:'0.72rem',padding:'2px 5px',borderRadius:6,background:'rgba(76,175,80,.15)',color:'var(--green)',fontWeight:700}}>🟢{dc.easy}</span>}
                    {dc.medium>0 && <span style={{fontSize:'0.72rem',padding:'2px 5px',borderRadius:6,background:'rgba(255,217,61,.15)',color:'var(--yellow)',fontWeight:700}}>🟡{dc.medium}</span>}
                    {dc.hard>0   && <span style={{fontSize:'0.72rem',padding:'2px 5px',borderRadius:6,background:'rgba(255,82,82,.15)',color:'var(--red)',fontWeight:700}}>🔴{dc.hard}</span>}
                  </div>
                )}
                {!avail&&<div className="fs-xs mut" style={{marginTop:4}}>All used ✓</div>}
              </button>
            );
          })}
        </div>
        {/* Only current team score */}
        <div className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:'1.8rem'}}>{ct.emoji}</span>
          <div><div className="fw8" style={{color:ct.color}}>{ct.name}</div><div className="mut fs-xs">Your score</div></div>
          <div style={{marginLeft:'auto',fontSize:'1.8rem',fontWeight:900,color:ct.color}}>{ct.score} pts</div>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // DIFFICULTY PICK (mentor picks — private decision)
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'diff_pick') {
    const dc      = diffCounts(chosenTopic);
    const topMeta = tm[chosenTopic] || {emoji:'🎯',color:'var(--blue)'};
    const DIFF_INFO = [
      { id:'easy',   icon:'🟢', label:'Easy',   pts:100, penalty:50,  desc:'Straightforward question — less risk' },
      { id:'medium', icon:'🟡', label:'Medium', pts:150, penalty:75,  desc:'Balanced challenge — fair risk/reward' },
      { id:'hard',   icon:'🔴', label:'Hard',   pts:200, penalty:100, desc:'Tough question — high risk, high reward' },
    ];
    return (
      <div className="screen" style={{alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{maxWidth:600,width:'100%'}}>
          {/* Mentor label */}
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',borderRadius:20,background:'rgba(255,217,61,.15)',border:'1px solid rgba(255,217,61,.4)',marginBottom:14}}>
              <span style={{fontSize:'1.15rem'}}>👩‍🏫</span>
              <span className="fw8 fs-sm" style={{color:'var(--yellow)'}}>MENTOR — Choose difficulty for {ct.name}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:6}}>
              <span style={{fontSize:'2rem'}}>{topMeta.emoji}</span>
              <span style={{fontSize:'1.5rem',fontWeight:900,color:topMeta.color}}>{chosenTopic}</span>
            </div>
            <p className="mut fs-sm">{ct.emoji} {ct.name} picked this topic. You choose the difficulty.</p>
          </div>

          {/* Difficulty cards */}
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
            {DIFF_INFO.map(d => {
              const available_count = dc[d.id] || 0;
              const unavail = available_count === 0;
              return (
                <button key={d.id} onClick={()=>!unavail&&pickDifficulty(d.id)} disabled={unavail}
                  style={{borderRadius:18,padding:'18px 22px',textAlign:'left',cursor:unavail?'not-allowed':'pointer',
                    background:unavail?'rgba(255,255,255,.03)':`linear-gradient(135deg,${d.id==='easy'?'rgba(76,175,80,.15)':d.id==='medium'?'rgba(255,217,61,.15)':'rgba(255,82,82,.15)'},transparent)`,
                    border:`2px solid ${unavail?'rgba(255,255,255,.06)':d.id==='easy'?'rgba(76,175,80,.5)':d.id==='medium'?'rgba(255,217,61,.5)':'rgba(255,82,82,.5)'}`,
                    opacity:unavail?.35:1,transition:'.22s',color:'inherit'}}
                  onMouseEnter={e=>{if(!unavail)e.currentTarget.style.transform='scale(1.02)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                  <div className="fl fla flb">
                    <div className="fl fla gap3">
                      <span style={{fontSize:'2rem'}}>{d.icon}</span>
                      <div>
                        <div style={{fontSize:'1.2rem',fontWeight:900,color:d.id==='easy'?'var(--green)':d.id==='medium'?'var(--yellow)':'var(--red)',marginBottom:2}}>{d.label}</div>
                        <div className="mut fs-sm">{d.desc}</div>
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:16}}>
                      <div className="grn fw8 fs-sm">✅ +{d.pts} pts</div>
                      <div className="rdc fw8 fs-sm">❌ −{d.penalty} pts</div>
                      {unavail
                        ? <div className="mut fs-xs" style={{marginTop:4}}>No questions left</div>
                        : <div className="mut fs-xs" style={{marginTop:4}}>{available_count} question{available_count!==1?'s':''} left</div>
                      }
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-block" onClick={()=>setPhase('topic_pick')}>← Team picks a different topic</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // QUESTION (team answers)
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'question' && question) {
    const q    = question;
    const meta = tm[q.topic] || {emoji:'🎯',color:'var(--blue)'};
    // Use q.q (backend field) NOT q.text
    const questionText = q.q || q.text || '(Question text missing)';
    return (
      <div className="screen" style={{background:'var(--bg)'}}>
        <div style={{padding:'12px 18px',background:'rgba(8,6,22,.92)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',gap:12}}>
          <div className="fl fla gap2 fl1">
            <div style={{padding:'4px 10px',borderRadius:10,background:`${ct.color}22`,border:`1.5px solid ${ct.color}55`,display:'flex',alignItems:'center',gap:6}}>
              <span>{ct.emoji}</span><span className="fw8 fs-sm" style={{color:ct.color}}>{ct.name}</span>
            </div>
            <div style={{padding:'4px 10px',borderRadius:10,background:`${meta.color}22`,border:`1.5px solid ${meta.color}44`,display:'flex',alignItems:'center',gap:5}}>
              <span>{meta.emoji}</span><span className="fw8 fs-sm" style={{color:meta.color}}>{q.topic}</span>
            </div>
          </div>
          <TimerRing value={timer} max={timerSecs} size={68}/>
        </div>
        <div style={{flex:1,padding:'16px 20px',maxWidth:760,margin:'0 auto',width:'100%'}}>
          {/* QUESTION CARD — question text is the main focus */}
          <div className="card mb3" style={{marginBottom:18,borderColor:`${meta.color}66`,borderWidth:2,padding:'24px 22px'}}>
            <div className="fl fla flb mb3" style={{marginBottom:14}}>
              <div className="fl fla gap2">
                <span className={`badge diff-${q.diff}`}>{q.diff}</span>
                <span className="badge b-green fs-xs">✅ +{DIFF_PTS[q.diff]?.correct} pts</span>
                <span className="badge b-red fs-xs">❌ −{DIFF_PTS[q.diff]?.wrong} pts</span>
              </div>
              <span style={{fontSize:'0.88rem',fontWeight:700,color:meta.color}}>{meta.emoji} {q.topic}</span>
            </div>
            {/* THE QUESTION TEXT — biggest element on screen */}
            <p style={{
              fontSize:'clamp(1.2rem,3.5vw,1.8rem)',
              fontWeight:900,
              lineHeight:1.5,
              color:'#FFFFFF',
              margin:0,
              letterSpacing:'-0.01em',
            }}>
              {questionText}
            </p>
            {q.mediaUrl && <QuestionMedia url={q.mediaUrl} type={q.mediaType} />}
          </div>
          {/* TIME'S UP BANNER — shown when timer reaches 0 */}
          {timer === 0 && answeredIdx === null && (
            <div style={{
              padding:'14px 18px',borderRadius:14,marginBottom:14,
              background:'rgba(255,82,82,.15)',border:'2px solid rgba(255,82,82,.6)',
              textAlign:'center',animation:'pulse 1s infinite',
            }}>
              <div style={{fontSize:'2rem',marginBottom:4}}>⏰</div>
              <div style={{fontSize:'1.15rem',fontWeight:900,color:'var(--red)'}}>Time's Up!</div>
              <div className="mut fs-sm" style={{marginTop:4}}>
                Sorry, {ct.name}! Points will be deducted. Mentor will show the answer.
              </div>
            </div>
          )}
          {/* COMEBACK CATCH-UP BONUS — shown when the CURRENT team qualifies (last place, final rounds) */}
          {answeredIdx===null && timer>0 && sharedComebackEligibleTeamIds.includes(ct.id) && (
            <div style={{padding:'10px 14px',borderRadius:12,marginBottom:10,background:'linear-gradient(135deg,rgba(76,175,80,.2),rgba(0,212,170,.15))',border:'2px solid rgba(76,175,80,.5)',textAlign:'center',fontWeight:800,color:'var(--green)',animation:'pulse 1.4s infinite',fontSize:'0.95rem'}}>
              🎯 COMEBACK BONUS — get this right for +{SHARED_COMEBACK_BONUS_POINTS} extra pts! 🎯
            </div>
          )}
          {/* 50/50 LIFELINE — shared across the answering team, 3 uses per game */}
          {answeredIdx===null && timer>0 && (
            <div className="fl fla flb mb2" style={{marginBottom:8,flexWrap:'wrap',gap:8}}>
              <button
                className="btn btn-sm"
                disabled={(fiftyFiftyUsed[ct.id]||0)>=SHARED_FIFTY_FIFTY_MAX || removedOpts.length>0}
                onClick={useFiftyFiftyShared}
                style={{
                  background: (fiftyFiftyUsed[ct.id]||0)>=SHARED_FIFTY_FIFTY_MAX ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,var(--blue2),var(--blue))',
                  opacity: (fiftyFiftyUsed[ct.id]||0)>=SHARED_FIFTY_FIFTY_MAX ? 0.5 : 1,
                  cursor: (fiftyFiftyUsed[ct.id]||0)>=SHARED_FIFTY_FIFTY_MAX ? 'not-allowed' : 'pointer',
                }}
              >
                🎯 50/50 {(fiftyFiftyUsed[ct.id]||0)>=SHARED_FIFTY_FIFTY_MAX ? '— used up' : `(${SHARED_FIFTY_FIFTY_MAX-(fiftyFiftyUsed[ct.id]||0)} left)`}
              </button>
            </div>
          )}
          {/* MCQ OPTIONS */}
          <div className="opts-grid" style={{marginBottom:16,gap:14}}>
            {q.opts.map((o,i)=>{
              let cls='opt-btn'; let sty={};
              const isRemoved = removedOpts.includes(i);
              if (answeredIdx!==null) {
                if (q.ans.includes(i)) cls+=' opt-correct';
                else if (i===answeredIdx) cls+=' opt-wrong';
                else sty.opacity=.3;
              } else if (isRemoved) {
                cls+=' opt-disabled'; sty.opacity=.25;
              }
              return(
                <button key={i} className={cls}
                  style={{...sty,fontSize:'1.05rem',padding:'18px 16px',minHeight:72,pointerEvents:(answeredIdx===null&&timer>0&&!isRemoved)?'auto':'none',opacity:timer===0&&answeredIdx===null?0.4:sty.opacity}}
                  onClick={()=>timer>0&&!isRemoved&&submitAnswer(i)}>
                  <div className="opt-letter" style={{width:40,height:40,fontSize:'0.95rem',fontWeight:900}}>{LETTERS[i]}</div>
                  <span style={{fontWeight:800}}>{o}</span>
                </button>
              );
            })}
          </div>
          {/* Only current team score */}
          <div className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:'1.6rem'}}>{ct.emoji}</span>
            <div><div className="fw8 fs-sm" style={{color:ct.color}}>{ct.name}</div><div className="mut fs-xs">Your score</div></div>
            <div style={{marginLeft:'auto',fontSize:'1.6rem',fontWeight:900,color:ct.color}}>{ct.score} pts</div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ════════════════════════════════════════════════════════════════════════
  if (phase === 'feedback' && feedback) {
    const f       = feedback;
    const correct = f.correct;
    const nextIdx = (curTeamIdx+1)%teamCount;
    const nextT   = teams[nextIdx];
    const isLast  = rounds.length>=qPerTeam*teamCount || Object.keys(available).length===0;
    return (
      <div className="screen" style={{alignItems:'center',justifyContent:'center',padding:20,position:'relative',overflow:'hidden'}}>
        {correct&&<Confetti active/>}
        {/* Giant background emojis */}
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4%',pointerEvents:'none',zIndex:0}}>
          <div style={{fontSize:'clamp(5rem,18vw,12rem)',animation:correct?'bounce 1s ease-in-out infinite':'shake 0.5s ease',opacity:.12}}>{f.emoji1}</div>
          <div style={{fontSize:'clamp(5rem,18vw,12rem)',animation:correct?'bounce 1s ease-in-out .15s infinite':'shake 0.5s ease .1s',opacity:.12}}>{f.emoji2}</div>
        </div>
        <div style={{maxWidth:580,width:'100%',position:'relative',zIndex:1}}>
          {/* Animated verdict emojis */}
          <div style={{textAlign:'center',marginBottom:12}}>
            <span style={{fontSize:'clamp(4rem,14vw,8rem)',display:'inline-block',animation:correct?'bounce .8s ease-in-out infinite':'shake .5s ease',marginRight:8}}>{f.emoji1}</span>
            <span style={{fontSize:'clamp(3rem,10vw,6rem)',display:'inline-block',animation:correct?'bounce .8s ease-in-out .1s infinite':'shake .5s ease .08s'}}>{f.emoji2}</span>
          </div>
          <div className="card tc mb3" style={{padding:'22px 20px',marginBottom:14,
            borderColor:correct?'rgba(76,175,80,.6)':f.timedOut?'rgba(255,217,61,.5)':'rgba(255,82,82,.6)',
            borderWidth:3,animation:'popIn .4s cubic-bezier(.34,1.56,.64,1)'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'8px 20px',borderRadius:24,background:`${f.teamColor}22`,border:`2px solid ${f.teamColor}77`,marginBottom:14}}>
              <span style={{fontSize:'1.8rem'}}>{f.teamEmoji}</span>
              <span style={{fontSize:'1.2rem',fontWeight:900,color:f.teamColor}}>{f.teamName}</span>
            </div>
            <div style={{fontSize:'clamp(1.6rem,5vw,2.4rem)',fontWeight:900,marginBottom:10,color:correct?'var(--green)':f.timedOut?'var(--yellow)':'var(--red)'}}>
              {f.timedOut?"Time's Up! ⏰":correct?'CORRECT! 🎯':'WRONG! 😮'}
            </div>
            {/* HUGE points */}
            <div style={{fontSize:'clamp(3rem,10vw,5.5rem)',fontWeight:900,lineHeight:1,marginBottom:14,
              color:f.change>0?'var(--green)':f.change<0?'var(--red)':'var(--t2)',
              textShadow:f.change>0?'0 0 40px rgba(76,175,80,.7)':f.change<0?'0 0 40px rgba(255,82,82,.7)':'none',
              animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)'}}>
              {f.change>0?'+':''}{f.change}
            </div>
            <div style={{fontSize:'1.05rem',fontWeight:700,color:'var(--t2)',marginBottom:14}}>points</div>
            {correct&&f.speedBonus>0&&<div className="badge b-yellow" style={{fontSize:'0.95rem',padding:'6px 16px',marginBottom:14}}>⚡ +{f.speedBonus} speed bonus!</div>}
            {f.comebackBonus&&<div className="badge b-green" style={{fontSize:'0.95rem',padding:'6px 16px',marginBottom:14,marginLeft:8}}>🎯 +{f.comebackBonusPoints||125} comeback bonus!</div>}
            <div style={{background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.35)',borderRadius:12,padding:'12px 16px',textAlign:'left',marginBottom:f.explanation?10:0}}>
              <span className="grn fw8">✅ Correct answer: {f.correctAns}</span>
            </div>
            {f.explanation&&<div style={{background:'var(--bg2)',borderLeft:'4px solid var(--blue2)',borderRadius:'0 12px 12px 0',padding:'10px 14px',textAlign:'left',fontSize:'0.95rem',color:'var(--t2)',lineHeight:1.6,marginTop:8}}>💡 {f.explanation}</div>}
            <MentorReaction correct={correct} />
            {/* Current team new total */}
            <div style={{marginTop:14,padding:'10px 14px',borderRadius:12,background:`${f.teamColor}15`,border:`1.5px solid ${f.teamColor}55`,textAlign:'left'}}>
              <span style={{color:f.teamColor,fontWeight:800}}>{f.teamEmoji} {f.teamName} new total: </span>
              <span style={{fontSize:'1.4rem',fontWeight:900,color:f.teamColor}}>
                {teams.find(t=>t.name===f.teamName)?.score ?? 0} pts
              </span>
            </div>
          </div>
          {!isLast&&<div style={{padding:'12px 16px',borderRadius:14,marginBottom:14,background:`${nextT.color}18`,border:`1.5px solid ${nextT.color}55`,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:'1.5rem'}}>{nextT.emoji}</span>
            <span className="fw8 fs-sm" style={{color:nextT.color}}>Up next: <strong>{nextT.name}</strong> picks a topic</span>
          </div>}
          {/* BIG CONTINUE BUTTON */}
          <button className="btn btn-primary btn-block btn-xl" onClick={nextTurn}
            style={{fontSize:'1.3rem',padding:'22px',marginTop:4,animation:'glow 2s infinite'}}>
            {isLast?'🏁 See Final Results':`➡️ ${nextT.name}'s Turn`}
          </button>
        </div>
      </div>
    );
  }



  if (phase === 'finished') {
    const sorted=[...teams].sort((a,b)=>b.score-a.score);
    const top3=sorted.slice(0,3);
    const podiumOrder=top3.length>=2?[top3[1],top3[0],top3[2]].filter(Boolean):top3;
    const podiumCls=top3.length>=2?['pod-2','pod-1','pod-3']:['pod-1'];
    const medals=['🥇','🥈','🥉'];
    return(
      <div className="screen">
        <Confetti active/>
        <nav className="nav">
          <span className="logo">🏆 Final Results</span>
          <button className="btn btn-ghost btn-sm" onClick={resetSharedGame}>🔄 Play Again</button>
        </nav>
        <div style={{flex:1,maxWidth:640,margin:'0 auto',width:'100%',padding:'20px'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <h2 style={{fontSize:'2rem',marginBottom:6}}>🎊 Game Over!</h2>
            <p className="mut fs-sm">{sorted[0]?.name} wins with <strong style={{color:sorted[0]?.color}}>{sorted[0]?.score} points!</strong></p>
          </div>
          <div className="podium-wrap mb4" style={{marginBottom:30}}>
            {podiumOrder.map((t,i)=>(
              <div key={t.id} style={{textAlign:'center',animation:`popIn .4s ease ${i*.12}s both`}}>
                <div style={{fontSize:'2rem',marginBottom:6}}>{t.emoji}</div>
                <div className={`podium-bar ${podiumCls[i]}`}>
                  <div style={{fontWeight:900,fontSize:'1.15rem',color:'rgba(255,255,255,.95)'}}>{i===1?medals[0]:i===0?medals[1]:medals[2]}</div>
                  <div style={{fontSize:'0.85rem',fontWeight:700,color:'rgba(255,255,255,.9)',marginTop:2}}>{t.name}</div>
                  <div style={{fontSize:'0.92rem',fontWeight:900,color:'rgba(255,255,255,.95)',marginTop:2}}>{t.score} pts</div>
                </div>
              </div>
            ))}
          </div>
          {/* Full scores */}
          <div className="card mb3" style={{marginBottom:16}}><div className="sec-title">📋 All Scores</div>
            {sorted.map((t,i)=>(
              <div key={t.id} className="fl fla gap3" style={{padding:'12px 14px',borderRadius:14,marginBottom:8,background:`${t.color}18`,border:`1.5px solid ${t.color}44`,animation:`slideL .35s ease ${i*.07}s both`}}>
                <span style={{fontSize:'1.4rem',minWidth:30}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                <span style={{fontSize:'1.5rem'}}>{t.emoji}</span>
                <div style={{flex:1}}>
                  <div className="fw8" style={{color:t.color}}>{t.name}</div>
                  <div className="fs-xs mut">{rounds.filter(r=>r.teamId===t.id&&r.correct).length} correct · {rounds.filter(r=>r.teamId===t.id&&!r.correct).length} wrong</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'1.4rem',fontWeight:900,color:t.color}}>{t.score}</div>
                  <div className="fs-xs mut">pts</div>
                </div>
              </div>
            ))}
          </div>
          {rounds.length>0&&<div className="card mb3" style={{marginBottom:14}}><div className="sec-title">📜 Round History</div>
            {rounds.map((r,i)=>{
              const td=teams.find(t=>t.id===r.teamId);
              return(<div key={i} className="fl fla gap2" style={{padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,.05)',flexWrap:'wrap'}}>
                <span className="mut fs-xs fw8" style={{minWidth:28}}>#{i+1}</span>
                <span>{td?.emoji}</span>
                <span className="fw8 fs-xs fl1" style={{color:td?.color}}>{r.teamName}</span>
                <span style={{padding:'2px 6px',borderRadius:6,background:`${tColor(r.topic,tm)}22`,color:tColor(r.topic,tm),fontSize:'0.82rem',fontWeight:700}}>{tEmoji(r.topic,tm)} {r.topic}</span>
                <span className={`badge diff-${r.diff}`} style={{fontSize:'0.75rem'}}>{r.diff}</span>
                <span className="fw8 fs-xs" style={{color:r.correct?'var(--green)':r.timedOut?'var(--yellow)':'var(--red)',textAlign:'right'}}>
                  {r.totalChange>0?'+':''}{r.totalChange} {r.timedOut?'⏰':r.correct?'✅':'❌'}
                </span>
              </div>);
            })}
          </div>}
          <div className="fl gap2">
            <button className="btn btn-ghost fl1" onClick={()=>{ window.history.pushState({},'','/'); window.location.reload(); }}>🏠 Home</button>
            <button className="btn btn-primary fl1" onClick={resetSharedGame}>🔄 Play Again</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}


/* ════════════════════════════════════════════════════════════
   FINAL LEADERBOARD  — shown to EVERYONE (mentor + students)
════════════════════════════════════════════════════════════ */
export function FinalLeaderboard() {
  const { state, dispatch, go } = useApp();
  const lb  = state.leaderboard;
  const gs  = state.gameState;
  const tm  = state.topicMeta;
  const isIndividualMode = state.gameMode === 'individual';
  const [conf,setConf] = useState(true);
  const [tab,setTab]   = useState('standings');

  useEffect(()=>{ playWinner(); const t=setTimeout(()=>setConf(false),3500); return()=>clearTimeout(t); },[]);

  const isMentorFinal = !!state.mentor;

  const clearGameState = () => {
    dispatch({ type:'SET_GAME', gameState: null });
    dispatch({ type:'SET_ROUND', roundResult: null });
    dispatch({ type:'SET_LEADERBOARD', leaderboard: null });
    dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: [] });
  };

  // Mentor: go to dashboard (stay logged in, clear game state)
  const goToDash = () => {
    clearGameState();
    go('mentor-dash');
  };

  // Mentor: play again → go to sessions to create new session
  const goPlayAgain = () => {
    clearGameState();
    go('mentor-dash');
    // Sessions tab opens automatically since we set section in MentorDash
  };

  // Student: go home
  const goHome = () => {
    dispatch({ type:'RESET' });
    go('landing');
  };

  if (!lb||lb.length===0) return (
    <div className="screen" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:'3rem',marginBottom:12,animation:'pulse 1s infinite'}}>⏳</div><p className="fw8">Loading final results…</p>
    </div>
  );

  // Individual mode leaderboard uses name/avatar instead of team color/emoji
  if (isIndividualMode) {
    const sorted = [...lb].sort((a,b)=>b.score-a.score);
    return (
      <div className="screen">
        <Confetti active={conf}/>
        <nav className="nav">
          <span className="logo">🏆 Final Results — Solo</span>
          {isMentorFinal
            ? <button className="btn btn-ghost btn-sm" onClick={goToDash}>🏫 Dashboard</button>
            : <button className="btn btn-ghost btn-sm" onClick={goHome}>🏠 Home</button>
          }
        </nav>
        <div style={{flex:1,maxWidth:640,margin:'0 auto',width:'100%',padding:'20px'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <h2 style={{fontSize:'2rem',marginBottom:6}}>🎊 Game Over!</h2>
            <p className="mut fs-sm">{sorted[0]?.name} wins with <strong style={{color:'var(--blue)'}}>{sorted[0]?.score} points!</strong></p>
          </div>
          {/* Podium */}
          <div className="podium-wrap mb4" style={{marginBottom:30}}>
            {(sorted.length>=2?[sorted[1],sorted[0],sorted[2]].filter(Boolean):sorted.slice(0,1)).map((p,i)=>(
              <div key={p.name||i} style={{textAlign:'center',animation:`popIn .4s ease ${i*.12}s both`}}>
                <div style={{fontSize:'2rem',marginBottom:6}}>{p.avatar||'🦁'}</div>
                <div className={`podium-bar ${sorted.length>=2?['pod-2','pod-1','pod-3'][i]:'pod-1'}`}>
                  <div style={{fontWeight:900,fontSize:'1.05rem',color:'rgba(255,255,255,.95)'}}>{sorted.length>=2?['🥈','🥇','🥉'][i]:'🥇'}</div>
                  <div style={{fontSize:'0.85rem',fontWeight:700,color:'rgba(255,255,255,.9)',marginTop:2}}>{p.name}</div>
                  <div style={{fontSize:'0.92rem',fontWeight:900,color:'rgba(255,255,255,.95)',marginTop:2}}>{p.score} pts</div>
                </div>
              </div>
            ))}
          </div>
          {/* Full ranking */}
          <div className="card mb3" style={{marginBottom:16}}>
            <div className="sec-title">🏅 All Players</div>
            {sorted.map((p,i)=>(
              <div key={p.name||i} className="fl fla gap3" style={{padding:'10px 12px',borderRadius:12,marginBottom:8,
                background:p.name===state.player?.name&&!isMentorFinal?'rgba(79,140,255,.12)':'rgba(255,255,255,.04)',
                border:`1.5px solid ${p.name===state.player?.name&&!isMentorFinal?'rgba(79,140,255,.4)':'rgba(255,255,255,.08)'}`,
                animation:`slideL .35s ease ${i*.07}s both`}}>
                <span style={{fontSize:'1.3rem',minWidth:30}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                <span style={{fontSize:'1.4rem'}}>{p.avatar||'🦁'}</span>
                <div style={{flex:1}}>
                  <div className="fw8" style={{color:p.name===state.player?.name&&!isMentorFinal?'var(--blue)':'var(--t1)'}}>{p.name}{p.name===state.player?.name&&!isMentorFinal?' (You)':''}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'1.4rem',fontWeight:900,color:'var(--blue)'}}>{p.score}</div>
                  <div className="fs-xs mut">pts</div>
                </div>
              </div>
            ))}
          </div>
          <div className="fl gap2 mb4" style={{marginBottom:20}}>
            {isMentorFinal ? (
              <>
                <button className="btn btn-ghost fl1" onClick={goToDash}>🏫 Go to Dashboard</button>
                <button className="btn btn-primary fl1" onClick={goPlayAgain}>🔄 Play Again</button>
              </>
            ) : (
              <button className="btn btn-primary btn-block" onClick={goHome}>🏠 Home</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const top3=lb.slice(0,3);
  const podiumOrder=top3.length>=2?[top3[1],top3[0],top3[2]].filter(Boolean):top3;
  const podiumCls  =top3.length>=2?['pod-2','pod-1','pod-3']:['pod-1'];
  const podiumMeds =top3.length>=2?['🥈','🥇','🥉']:['🥇'];
  const history    = gs?.roundHistory||[];

  return (
    <div className="screen">
      <Confetti active={conf}/>
      <nav className="nav">
        <span className="logo">🏆 Final Results</span>
        {isMentorFinal
          ? <button className="btn btn-ghost btn-sm" onClick={goToDash}>🏫 Dashboard</button>
          : <button className="btn btn-ghost btn-sm" onClick={goHome}>🏠 Home</button>
        }
      </nav>
      <div style={{flex:1,maxWidth:700,margin:'0 auto',width:'100%',padding:'20px'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <h2 style={{fontSize:'2rem',marginBottom:6}}>🎊 Game Over!</h2>
          <p className="mut fs-sm">{lb[0]?.name} wins with <strong style={{color:lb[0]?.color}}>{lb[0]?.score} points!</strong></p>
        </div>
        {/* Podium */}
        <div className="podium-wrap mb4" style={{marginBottom:30}}>
          {podiumOrder.map((t,i)=>(
            <div key={t.id} style={{textAlign:'center',animation:`popIn .4s ease ${i*.12}s both`}}>
              <div style={{fontSize:'2rem',marginBottom:6}}>{t.emoji}</div>
              <div className={`podium-bar ${podiumCls[i]}`}>
                <div style={{fontWeight:900,fontSize:'1.15rem',color:'rgba(255,255,255,.95)'}}>{podiumMeds[i]}</div>
                <div style={{fontSize:'0.85rem',fontWeight:700,color:'rgba(255,255,255,.9)',marginTop:2}}>{t.name}</div>
                <div style={{fontSize:'0.92rem',fontWeight:900,color:'rgba(255,255,255,.95)',marginTop:2}}>{t.score} pts</div>
              </div>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="fl gap2 mb3" style={{marginBottom:14}}>
          {[['standings','🏆 Standings'],['history','📜 Round History']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} className="btn btn-sm" style={{flex:1,background:tab===id?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${tab===id?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:tab===id?'#fff':'var(--t2)'}}>{lbl}</button>
          ))}
        </div>
        {tab==='standings'&&<>
          <div className="card mb3" style={{marginBottom:14}}><div className="sec-title">📋 All Teams</div>
            {lb.map((t,i)=>(
              <div key={t.id} className="fl fla gap3" style={{padding:'12px 14px',borderRadius:14,marginBottom:8,background:`${t.color}18`,border:`1.5px solid ${t.color}44`,animation:`slideL .35s ease ${i*.07}s both`}}>
                <span style={{fontSize:'1.4rem',minWidth:30}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                <span style={{fontSize:'1.5rem'}}>{t.emoji}</span>
                <div style={{flex:1}}><div className="fw8" style={{color:t.color}}>{t.name}</div>
                  <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                    <span className="fs-xs grn">✅ {t.correct} correct</span>
                    <span className="fs-xs rdc">❌ {t.wrong} wrong</span>
                    <span className="fs-xs mut">{t.roundsPlayed} rounds</span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'1.4rem',fontWeight:900,color:t.color}}>{t.score}</div>
                  <div className="fs-xs grn">+{t.totalEarned}</div>
                  <div className="fs-xs rdc">−{t.totalLost}</div>
                </div>
              </div>
            ))}
          </div>
          {gs?.teams&&<div className="card mb3" style={{marginBottom:14}}><div className="sec-title">📊 Questions Per Team</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
              {gs.teams.map(t=>{ const p=teamProgress(gs,t.id); return(
                <div key={t.id} style={{padding:'10px 12px',borderRadius:12,background:`${t.color}15`,border:`1.5px solid ${t.color}44`}}>
                  <div style={{color:t.color,fontWeight:800,fontSize:'0.92rem',marginBottom:6}}>{t.emoji} {t.name}</div>
                  <div style={{fontSize:'1.4rem',fontWeight:900,color:t.color}}>{p.played}/{p.total}</div>
                  <div className="progress-bar" style={{marginTop:6}}><div className="progress-fill" style={{width:`${p.pct}%`,background:t.color}}/></div>
                </div>
              );})}
            </div>
          </div>}
        </>}
        {tab==='history'&&<div className="card mb3" style={{marginBottom:14}}><div className="sec-title">📜 All Rounds</div>
          {history.length===0?<p className="mut fs-sm">No history</p>:history.map((r,i)=>{
            const td=gs?.teams?.find(t=>t.id===r.teamId);
            return(<div key={i} style={{padding:'10px 12px',borderRadius:12,marginBottom:8,background:r.correct?'rgba(76,175,80,.06)':r.timedOut?'rgba(255,217,61,.06)':'rgba(255,82,82,.06)',border:`1px solid ${r.correct?'rgba(76,175,80,.2)':r.timedOut?'rgba(255,217,61,.2)':'rgba(255,82,82,.2)'}`}}>
              <div className="fl fla flb mb1" style={{marginBottom:5}}>
                <div className="fl fla gap2"><span className="mut fs-xs fw8">#{i+1}</span><span>{td?.emoji}</span><span className="fw8 fs-sm" style={{color:td?.color}}>{r.teamName}</span></div>
                <div className="fl fla gap2">
                  <span style={{padding:'2px 7px',borderRadius:8,background:`${tColor(r.topic,tm)}22`,color:tColor(r.topic,tm),fontSize:'0.82rem',fontWeight:700}}>{tEmoji(r.topic,tm)} {r.topic}</span>
                  <span className={`badge diff-${r.diff}`} style={{fontSize:'0.75rem'}}>{r.diff}</span>
                  <span className="fw8 fs-sm" style={{color:r.correct?'var(--green)':r.timedOut?'var(--yellow)':'var(--red)'}}>{r.totalChange>0?'+':''}{r.totalChange} pts</span>
                </div>
              </div>
              <div className="fs-xs mut">{r.question}</div>
              <div className="fs-xs grn mt1" style={{marginTop:4}}>✅ {r.correctAns}</div>
            </div>);
          })}
        </div>}
        <div className="fl gap2 mb4" style={{marginBottom:20}}>
          {isMentorFinal ? (
            <>
              <button className="btn btn-ghost fl1" onClick={goToDash}>🏫 Go to Dashboard</button>
              <button className="btn btn-primary fl1" onClick={goPlayAgain}>🔄 Play Again</button>
            </>
          ) : (
            <button className="btn btn-primary btn-block" onClick={goHome}>🏠 Home</button>
          )}
        </div>
      </div>
    </div>
  );
}
