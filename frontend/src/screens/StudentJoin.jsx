import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { connectSocket } from '../utils/socket';
import { useEmit } from '../hooks/useSocket';
import { Spinner } from '../components/shared';
import { getOrCreatePlayerId, saveRejoinInfo } from '../utils/rejoin';

const AVATARS = ['🦁','🦊','🐱','🐸','🦋','🦄','🐯','🐻','🐼','🦅','🐧','🦉','🐬','🐺','🦖','🦕'];

/* ════════════════════════════
   TEAM-BASED JOIN (Multi-Device)
════════════════════════════ */
export function StudentJoin() {
  const { go, toast, dispatch } = useApp();
  const emit = useEmit();

  const [step,    setStep]    = useState(1);
  const [name,    setName]    = useState('');
  const [code,    setCode]    = useState('');
  const [avatar,  setAvatar]  = useState(AVATARS[0]);
  const [session, setSession] = useState(null);
  const [team,    setTeam]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [codeErr, setCodeErr] = useState('');

  // Clear team selection when session changes (prevents stale team 3 etc.)
  useEffect(() => { setTeam(null); }, [session]);

  const handleCode = async (raw) => {
    const val = raw.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    setCode(val); setCodeErr(''); setSession(null);
    if (val.length === 6) {
      try {
        const res = await api.getSession(val);
        if (res.session.mode === 'individual') {
          setCodeErr('This code is for Solo Mode. Use "Solo Player" on the home screen.');
          return;
        }
        setSession(res.session);
      } catch {
        setCodeErr('Invalid code — ask your mentor');
      }
    }
  };

  const proceed = () => {
    if (!name.trim())                    { toast('Enter a nickname!','error'); return; }
    if (!code || !session)               { toast('Enter a valid game code','error'); return; }
    if (session.status==='finished')     { toast('This session has already ended!','error'); return; }
    if (session.status==='playing')      { toast('Game already started! Ask mentor to wait.','error'); return; }
    setStep(2);
  };

  const joinGame = async () => {
    if (!team) { toast('Select your team first!','error'); return; }

    // Strict validation: team must be in session's team list
    const validTeam = session.teams.find(t => t.id === team.id);
    if (!validTeam) { toast('Invalid team selection!','error'); setTeam(null); return; }

    setLoading(true);
    try {
      connectSocket();
      const playerId = getOrCreatePlayerId();
      const res = await emit('student-join', { code, name: name.trim(), teamId: validTeam.id, avatar, playerId });
      dispatch({ type:'SET_PLAYER', player: { name:name.trim(), teamId:validTeam.id, avatar, sessionCode:code, score:0, socketId:res.player?.socketId, playerId } });
      dispatch({ type:'SET_GAME', gameState: res.state });
      saveRejoinInfo({ code, playerId, mode:'team' });
      toast(`Welcome to ${validTeam.name}! 🎉`, 'success');
      go('lobby');
    } catch(err) {
      toast(err.message,'error');
    }
    setLoading(false);
  };

  return (
    <div className="screen">
      <nav className="nav">
        <span className="logo">BrainBoom</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>go('landing')}>← Back</button>
      </nav>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div className="card card-glow" style={{maxWidth:480,width:'100%'}}>

          {step===1 && <>
            <div style={{fontSize:'2.8rem',textAlign:'center',marginBottom:12}}>🎮</div>
            <h2 style={{fontSize:'1.6rem',textAlign:'center',marginBottom:4}}>Join the Battle!</h2>
            <p className="mut tc fs-sm mb3" style={{marginBottom:20}}>Enter your details to get into the arena</p>

            <div className="fg">
              <label className="lbl">Your Nickname</label>
              <input className="inp inp-lg" value={name} onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&proceed()} placeholder="Choose a cool name…" maxLength={20}/>
            </div>

            <div className="fg">
              <label className="lbl">Game Code <span className="mut">(from your mentor)</span></label>
              <input className="inp inp-code" value={code} onChange={e=>handleCode(e.target.value)} placeholder="XXXXXX" maxLength={6}/>
              {code.length===6 && session && (
                <div style={{marginTop:8,padding:'10px 14px',borderRadius:12,background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)'}}>
                  <div className="fl fla gap2">
                    <span>✅</span>
                    <div>
                      <div className="fw8 grn fs-sm">{session.title}</div>
                      <div className="mut fs-xs">{session.questionCount} questions · {session.timerSeconds}s per turn · {session.teams.length} teams</div>
                    </div>
                  </div>
                </div>
              )}
              {codeErr && (
                <div style={{marginTop:8,padding:'8px 14px',borderRadius:12,background:'rgba(255,82,82,.08)',border:'1px solid rgba(255,82,82,.3)'}}>
                  <span className="rdc fs-sm fw8">❌ {codeErr}</span>
                </div>
              )}
            </div>

            <div className="fg">
              <label className="lbl">Choose Your Avatar</label>
              <div className="fl flw gap2" style={{gap:8}}>
                {AVATARS.map(a=>(
                  <div key={a} onClick={()=>setAvatar(a)} style={{
                    fontSize:'1.6rem',cursor:'pointer',borderRadius:'50%',width:46,height:46,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    border:`2px solid ${avatar===a?'var(--yellow)':'transparent'}`,
                    background:avatar===a?'rgba(255,217,61,.1)':'rgba(255,255,255,.04)',
                    transition:'.18s',transform:avatar===a?'scale(1.15)':'scale(1)',
                  }}>{a}</div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-block btn-lg mt3" style={{marginTop:14}} onClick={proceed} disabled={!session||!!codeErr}>
              {session ? `Continue → Pick Team` : 'Enter a valid code to continue'}
            </button>
          </>}

          {step===2 && session && <>
            <button className="btn btn-ghost btn-sm mb3" style={{marginBottom:14}} onClick={()=>setStep(1)}>← Back</button>
            <div style={{fontSize:'2.5rem',textAlign:'center',marginBottom:12}}>👥</div>
            <h2 style={{fontSize:'1.5rem',textAlign:'center',marginBottom:4}}>Pick Your Team!</h2>
            <p className="mut tc fs-sm mb3" style={{marginBottom:20}}>All teams use the same code — choose your side</p>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
              {/* Only show teams that exist in this session */}
              {session.teams.map(t=>(
                <div key={t.id} onClick={()=>setTeam(t)} style={{
                  borderRadius:18,padding:'18px 14px',textAlign:'center',cursor:'pointer',
                  background:team?.id===t.id?`${t.color}22`:'var(--bg3)',
                  border:`2px solid ${team?.id===t.id?t.color:'rgba(255,255,255,.1)'}`,
                  transition:'.22s',transform:team?.id===t.id?'translateY(-4px)':'none',
                  boxShadow:team?.id===t.id?`0 8px 24px ${t.color}44`:'none',
                }}>
                  <div style={{fontSize:'2.5rem',marginBottom:8}}>{t.emoji}</div>
                  <div className="fw8" style={{color:team?.id===t.id?t.color:'var(--t1)'}}>{t.name}</div>
                  <div className="mut fs-xs mt1">{t.playerCount} joined</div>
                </div>
              ))}
            </div>

            {team && (
              <div style={{marginBottom:14,padding:'10px 14px',borderRadius:12,background:`${team.color}18`,border:`1.5px solid ${team.color}55`,display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:'1.8rem'}}>{avatar}</span>
                <div>
                  <div className="fw8 fs-sm" style={{color:team.color}}>{name}</div>
                  <div className="mut fs-xs">{team.emoji} {team.name}</div>
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" onClick={joinGame} disabled={!team||loading}>
              {loading ? <><Spinner size={18}/> Joining…</> : team ? `🚀 Join ${team.name}!` : 'Select a team first'}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════
   INDIVIDUAL PLAYER JOIN
════════════════════════════ */
export function IndividualJoin() {
  const { go, toast, dispatch } = useApp();
  const emit = useEmit();

  const [name,    setName]    = useState('');
  const [code,    setCode]    = useState('');
  const [avatar,  setAvatar]  = useState(AVATARS[0]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codeErr, setCodeErr] = useState('');

  const handleCode = async (raw) => {
    const val = raw.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    setCode(val); setCodeErr(''); setSession(null);
    if (val.length === 6) {
      try {
        const res = await api.getSession(val);
        if (res.session.mode === 'team') {
          setCodeErr('This code is for a Team Game. Use "Team Game" on the home screen.');
          return;
        }
        setSession(res.session);
      } catch {
        setCodeErr('Invalid code — ask your mentor');
      }
    }
  };

  const joinGame = async () => {
    if (!name.trim())                { toast('Enter your name!','error'); return; }
    if (!code || !session)           { toast('Enter a valid game code','error'); return; }
    if (session.status==='finished') { toast('This session has already ended!','error'); return; }
    if (session.status==='playing')  { toast('Game already started! Ask your mentor to wait.','error'); return; }

    setLoading(true);
    try {
      connectSocket();
      // Individual players join team 'IND' (individual pool), or first team as default
      // We use a special solo team id that the backend resolves
      const soloTeam = session.teams[0]; // fallback — server tracks individual scores
      const playerId = getOrCreatePlayerId();
      const res = await emit('student-join', {
        code, name: name.trim(), teamId: soloTeam.id, avatar, mode: 'individual', playerId
      });
      dispatch({ type:'SET_PLAYER', player: {
        name: name.trim(), teamId: soloTeam.id, avatar,
        sessionCode: code, score: 0, mode: 'individual',
        socketId: res.player?.socketId, playerId,
      }});
      dispatch({ type:'SET_GAME', gameState: res.state });
      saveRejoinInfo({ code, playerId, mode:'individual' });
      toast(`You're in! Good luck ${name}! 🏅`, 'success');
      go('lobby');
    } catch(err) {
      toast(err.message,'error');
    }
    setLoading(false);
  };

  return (
    <div className="screen">
      <nav className="nav">
        <span className="logo">BrainBoom</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>go('landing')}>← Back</button>
      </nav>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div className="card card-glow" style={{maxWidth:550,width:'100%'}}>
          <div style={{fontSize:'2.8rem',textAlign:'center',marginBottom:12}}>🏅</div>
          <h2 style={{fontSize:'1.6rem',textAlign:'center',marginBottom:4}}>Solo Player Mode</h2>
          <p className="mut tc fs-sm" style={{marginBottom:20}}>Compete individually — your score is tracked by name!</p>

          <div style={{padding:'10px 16px',borderRadius:12,background:'rgba(76,175,80,.08)',border:'1px solid rgba(76,175,80,.2)',marginBottom:18,fontSize:'0.9rem',color:'var(--green)'}}>
            🏆 In Solo mode, each player's score is tracked individually.<br></br> A live leaderboard shows everyone's ranking after each question.
          </div>

          <div className="fg">
            <label className="lbl">Your Name</label>
            <input className="inp inp-lg" value={name} onChange={e=>setName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&joinGame()} placeholder="Enter your full name…" maxLength={25}/>
          </div>

          <div className="fg">
            <label className="lbl">Game Code <span className="mut">(from your mentor)</span></label>
            <input className="inp inp-code" value={code} onChange={e=>handleCode(e.target.value)} placeholder="XXXXXX" maxLength={6}/>
            {code.length===6 && session && (
              <div style={{marginTop:8,padding:'10px 14px',borderRadius:12,background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)'}}>
                <div className="fl fla gap2">
                  <span>✅</span>
                  <div>
                    <div className="fw8 grn fs-sm">{session.title}</div>
                    <div className="mut fs-xs">{session.questionCount} questions · {session.timerSeconds}s per turn{session.maxPlayers ? ` · Max ${session.maxPlayers} players` : ''}</div>
                  </div>
                </div>
              </div>
            )}
            {codeErr && (
              <div style={{marginTop:8,padding:'8px 14px',borderRadius:12,background:'rgba(255,82,82,.08)',border:'1px solid rgba(255,82,82,.3)'}}>
                <span className="rdc fs-sm fw8">❌ {codeErr}</span>
              </div>
            )}
          </div>

          <div className="fg">
            <label className="lbl">Choose Your Avatar</label>
            <div className="fl flw gap2" style={{gap:8}}>
              {AVATARS.map(a=>(
                <div key={a} onClick={()=>setAvatar(a)} style={{
                  fontSize:'1.6rem',cursor:'pointer',borderRadius:'50%',width:46,height:46,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  border:`2px solid ${avatar===a?'var(--yellow)':'transparent'}`,
                  background:avatar===a?'rgba(255,217,61,.1)':'rgba(255,255,255,.04)',
                  transition:'.18s',transform:avatar===a?'scale(1.15)':'scale(1)',
                }}>{a}</div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-block btn-lg mt3" style={{marginTop:14,background:'linear-gradient(135deg,#4CAF50,#00D4AA)'}}
            onClick={joinGame} disabled={!session||!!codeErr||loading}>
            {loading ? <><Spinner size={18}/> Joining…</> : session ? '🏅 Enter Solo Game' : 'Enter a valid code to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
