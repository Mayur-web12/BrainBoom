import React, { useState, useEffect, useCallback } from 'react';
import { useApp, getTopicEmoji, getTopicColor } from '../context/AppContext';
import { api } from '../utils/api';
import { useEmit } from '../hooks/useSocket';
import { Modal, TeamScoreRow, TimerRing, Spinner } from '../components/shared';

// ─── TEAM PRESETS ────────────────────────────────────────────────────────────
const TEAM_PRESETS = [
  { id:'A', name:'Team Alpha',   color:'#4F8CFF', emoji:'🔵' },
  { id:'B', name:'Team Bravo',   color:'#FF5252', emoji:'🔴' },
  { id:'C', name:'Team Charlie', color:'#4CAF50', emoji:'🟢' },
  { id:'D', name:'Team Delta',   color:'#FFD93D', emoji:'🟡' },
  { id:'E', name:'Team Echo',    color:'#FF6B9D', emoji:'🩷' },
  { id:'F', name:'Team Foxtrot', color:'#00D4AA', emoji:'🩵' },
];

const SECTIONS = [
  { id:'dashboard', icon:'📊', label:'Dashboard'    },
  { id:'sessions',  icon:'🎮', label:'Sessions'     },
  { id:'live',      icon:'🔴', label:'Live Control' },
  { id:'monitor',   icon:'🖥️',  label:'Shared Screen'},
  { id:'builder',   icon:'✏️',  label:'Quiz Builder' },
  { id:'topics',    icon:'📂', label:'Topics'       },
  { id:'results',   icon:'📈', label:'Results'      },
];

const DIFF_PTS = { easy:{ correct:100, wrong:50 }, medium:{ correct:150, wrong:75 }, hard:{ correct:200, wrong:100 } };
const LETTERS  = ['A','B','C','D','E','F'];

// ─── MENTOR DASH SHELL ────────────────────────────────────────────────────────
export function MentorDash() {
  const { toast, dispatch, state, go } = useApp();
  const topicMeta = state.topicMeta;                     // dynamic — from context
  const topics    = Object.keys(topicMeta);

  const [section,     setSection]     = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessions,    setSessions]    = useState([]);
  const [dbQuestions, setDbQuestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const emit = useEmit();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, qRes] = await Promise.all([api.getSessions(), api.getQuestions()]);
      setSessions(sRes.sessions || []);
      setDbQuestions(qRes.questions || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-switch sidebar to Live Control when game is active
  useEffect(() => {
    if (state.gameState && ['playing','round_result','topic_pick'].includes(state.gameState.status)) {
      setSection('live');
    }
  }, [state.gameState?.status]);

  // When game finishes: refresh session data so Results page updates immediately,
  // and switch sidebar to Results so mentor sees the completed game results right away
  useEffect(() => {
    if (state.gameState?.status === 'finished') {
      loadData();   // re-fetch so sessions list shows 'finished' status
    }
  }, [state.gameState?.status]); // eslint-disable-line

  // Auto-reload sessions list when a game finishes so the Sessions and Results
  // pages immediately show updated status and final scores without manual refresh
  useEffect(() => {
    if (state.gameFinishedAt) {
      loadData();
    }
  }, [state.gameFinishedAt]); // eslint-disable-line

  const joinSessionControl = async (code) => {
    try {
      const res = await emit('mentor-join-session', { code });
      dispatch({ type:'SET_GAME', gameState: res.state });
      setSection('live');
      toast(`Connected to ${code} 🎮`, 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="screen">
      <nav className="nav">
        {/* Unique Mentor Logo */}
        <div className="fl fla gap2 header-brand">
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'linear-gradient(135deg,#7B61FF,#4F8CFF)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.15rem', flexShrink:0,
            boxShadow:'0 2px 12px rgba(123,97,255,.45)',
          }}>🎓</div>
          <div>
            <div style={{
              fontFamily:'Fredoka,cursive', fontSize:'1.15rem', fontWeight:700, lineHeight:1,
              background:'linear-gradient(90deg,#fff,#7B61FF)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>BrainBoom</div>
            <div style={{ fontSize:'0.72rem', fontWeight:800, color:'var(--blue2)', letterSpacing:1.5, textTransform:'uppercase', lineHeight:1 }}>Mentor Panel</div>
          </div>
        </div>
        <div className="fl fla gap2">
          {/* Mentor avatar chip — no name shown. Hidden on mobile/tablet (see CSS) to
              declutter the header; Logout is still reachable via the drawer. */}
          <div className="header-avatar-chip" style={{
            width:36, height:36, borderRadius:'50%',
            background:'linear-gradient(135deg,#FFD93D,#FF8C42)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.15rem', cursor:'default',
            boxShadow:'0 2px 10px rgba(255,217,61,.35)',
            title: state.mentor?.name,
          }} title={state.mentor?.name}>👩‍🏫</div>
          <button className="mobile-menu-btn" aria-label="Open menu" onClick={()=>setMobileMenuOpen(true)}>☰</button>
          <button className="btn btn-ghost btn-sm header-logout-btn" onClick={() => { api.logout(); dispatch({ type:'MENTOR_LOGOUT' }); }}>Logout</button>
        </div>
      </nav>
      {/* MOBILE / TABLET NAV DRAWER — sidebar is hidden below 768px (see .sidebar CSS),
          so this is the only way to switch sections on phones/tablets. */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={()=>setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={e=>e.stopPropagation()}>
            <div className="fl fla flb" style={{marginBottom:14}}>
              <span className="fw8" style={{fontSize:'1.05rem'}}>Menu</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setMobileMenuOpen(false)}>✕</button>
            </div>
            {SECTIONS.map(s => (
              <div key={s.id} className={`sb-item ${section===s.id?'active':''}`}
                onClick={() => { setSection(s.id); setMobileMenuOpen(false); }}>
                <span>{s.icon}</span> {s.label}
                {s.id==='live' && state.gameState?.status==='playing' && (
                  <span className="badge b-red" style={{marginLeft:'auto',fontSize:'0.72rem',animation:'pulse 1s infinite'}}>LIVE</span>
                )}
              </div>
            ))}
            <div className="divider"/>
            <div className="sb-item" onClick={() => { setMobileMenuOpen(false); api.logout(); dispatch({ type:'MENTOR_LOGOUT' }); }}><span>🚪</span> Logout</div>
          </div>
        </div>
      )}
      <div className="fl" style={{ flex:1, minHeight:0, overflow:'hidden' }}>
        {/* SIDEBAR */}
        <div className="sidebar">
          {SECTIONS.map(s => (
            <div key={s.id} className={`sb-item ${section===s.id?'active':''}`} onClick={() => setSection(s.id)}>
              <span>{s.icon}</span> {s.label}
              {s.id==='live' && state.gameState?.status==='playing' && (
                <span className="badge b-red" style={{marginLeft:'auto',fontSize:'0.72rem',animation:'pulse 1s infinite'}}>LIVE</span>
              )}
            </div>
          ))}
          <div className="divider"/>
          <div className="sb-item" onClick={() => { api.logout(); dispatch({ type:'MENTOR_LOGOUT' }); }}><span>🚪</span> Logout</div>
        </div>
        {/* MAIN */}
        <div className="mentor-main">
          {section==='dashboard' && <DashHome sessions={sessions} loading={loading} dbQuestions={dbQuestions} topicMeta={topicMeta} />}
          {section==='sessions'  && <Sessions sessions={sessions} topics={topics} topicMeta={topicMeta} dbQuestions={dbQuestions} onRefresh={loadData} toast={toast} onControl={joinSessionControl} onViewResults={()=>setSection('results')} />}
          {section==='live'      && <LiveControl emit={emit} toast={toast} topicMeta={topicMeta} onNavigate={setSection} onRefresh={loadData} />}
          {section==='monitor'   && <SharedScreenMonitor dbQuestions={dbQuestions} topicMeta={topicMeta} />}
          {section==='builder'   && <Builder toast={toast} dbQuestions={dbQuestions} setDbQuestions={setDbQuestions} topics={topics} topicMeta={topicMeta} />}
          {section==='topics'    && <Topics topicMeta={topicMeta} dbQuestions={dbQuestions} setDbQuestions={setDbQuestions} toast={toast} />}
          {section==='results'   && <Results sessions={sessions} onRefresh={loadData} onDeleteSession={async (code) => { try { await api.deleteSession(code); loadData(); toast('Result deleted','info'); } catch(e){ toast(e.message,'error'); } }} />}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashHome({ sessions, loading, dbQuestions, topicMeta }) {
  if (loading) return <div className="fl fla flc" style={{padding:40}}><Spinner size={32}/></div>;
  const active  = sessions.filter(s=>s.status==='playing').length;
  const players = sessions.reduce((a,s)=>a+s.teams.reduce((b,t)=>b+t.playerCount,0),0);
  const byTopic = {};
  dbQuestions.forEach(q => { byTopic[q.topic]=(byTopic[q.topic]||0)+1; });

  return (
    <div>
      <h2 style={{fontSize:'1.5rem',marginBottom:18}}>📊 Dashboard</h2>
      <div className="grid4 mb4" style={{marginBottom:20}}>
        {[['🎮',sessions.length,'Sessions'],['🔴',active,'Live'],['👥',players,'Players'],['📝',dbQuestions.length,'Questions']].map(([ic,v,l])=>(
          <div key={l} className="stat-c"><div style={{fontSize:'1.6rem',marginBottom:8}}>{ic}</div><div className="stat-num">{v}</div><div className="mut fs-sm">{l}</div></div>
        ))}
      </div>
      <div className="card mb3" style={{marginBottom:16}}>
        <div className="sec-title">📚 Question Bank</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
          {Object.entries(topicMeta).map(([name,meta])=>{
            const cnt=byTopic[name]||0;
            return (
              <div key={name} style={{padding:'12px 14px',borderRadius:14,background:`${meta.color}18`,border:`1.5px solid ${meta.color}44`,textAlign:'center'}}>
                <div style={{fontSize:'1.5rem',marginBottom:5}}>{meta.emoji}</div>
                <div className="fw8 fs-sm" style={{color:meta.color}}>{name}</div>
                <div className="badge b-purple" style={{marginTop:5,fontSize:'0.75rem'}}>{cnt} q</div>
              </div>
            );
          })}
        </div>
      </div>
      {sessions.length>0 && (
        <div className="card">
          <div className="sec-title">🎮 Recent Sessions</div>
          {sessions.slice(0,6).map(s=>(
            <div key={s.code} className="fl fla gap3" style={{padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
              <span className="badge b-purple" style={{fontFamily:'Fredoka,cursive',letterSpacing:2}}>{s.code}</span>
              <span className="fw8 fl1">{s.title}</span>
              <span className={`badge b-${s.status==='playing'?'red':s.status==='finished'?'green':'blue'}`}>{s.status}</span>
                    {s.mode==='individual'&&<span className="badge" style={{background:'rgba(76,175,80,.2)',color:'var(--green)',border:'1px solid rgba(76,175,80,.4)'}}>🏅 Solo</span>}{s.maxPlayers&&<span className="badge b-purple" style={{fontSize:'0.75rem'}}>Max {s.maxPlayers}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────
function Sessions({ sessions, topics, topicMeta, dbQuestions, onRefresh, toast, onControl, onViewResults }) {
  const [showCreate,     setShowCreate]     = useState(false);
  const [showSoloCreate, setShowSoloCreate] = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [form, setForm] = useState({
    title:'', timerSeconds:30, diffFilter:'all', selectedTopics:[], teamCount:4, questionsPerTeam:10, maxPlayers:25,
    teams: TEAM_PRESETS.slice(0,4).map(t=>({...t})),
  });
  const [soloForm, setSoloForm] = useState({
    title:'', timerSeconds:30, diffFilter:'all', selectedTopics:[], questionsPerRound:10, maxPlayers:40,
  });

  const setTeamCount = n => setForm(p=>({...p,teamCount:n,teams:TEAM_PRESETS.slice(0,n).map(t=>({...t}))}));
  const updateTeam   = (i,f,v) => setForm(p=>{const t=[...p.teams];t[i]={...t[i],[f]:v};return{...p,teams:t};});
  const toggleTopic  = t => setForm(p=>({...p,selectedTopics:p.selectedTopics.includes(t)?p.selectedTopics.filter(x=>x!==t):[...p.selectedTopics,t]}));
  const toggleSoloTopic = t => setSoloForm(p=>({...p,selectedTopics:p.selectedTopics.includes(t)?p.selectedTopics.filter(x=>x!==t):[...p.selectedTopics,t]}));

  const available = (() => {
    let pool = dbQuestions;
    if (form.selectedTopics.length>0) pool = pool.filter(q=>form.selectedTopics.includes(q.topic));
    if (form.diffFilter!=='all')       pool = pool.filter(q=>q.diff===form.diffFilter);
    return pool.length;
  })();

  const soloAvailable = (() => {
    let pool = dbQuestions;
    if (soloForm.selectedTopics.length>0) pool = pool.filter(q=>soloForm.selectedTopics.includes(q.topic));
    if (soloForm.diffFilter!=='all')       pool = pool.filter(q=>q.diff===soloForm.diffFilter);
    return pool.length;
  })();

  const create = async () => {
    if (!form.title.trim()) { toast('Enter a title!','error'); return; }
    if (available===0) { toast('No questions match filters!','error'); return; }
    setCreating(true);
    try {
      const res = await api.createSession({
        title:form.title.trim(), teams:form.teams, timerSeconds:form.timerSeconds,
        diffFilter:form.diffFilter, topicFilter:form.selectedTopics, questionsPerTeam:form.questionsPerTeam,
        mode:'team', maxPlayers:form.maxPlayers,
      });
      toast(`Team session created! Code: ${res.session.code} 🎉`,'success');
      setShowCreate(false);
      setForm({title:'',timerSeconds:30,diffFilter:'all',selectedTopics:[],teamCount:4,questionsPerTeam:10,maxPlayers:25,teams:TEAM_PRESETS.slice(0,4).map(t=>({...t}))});
      onRefresh();
    } catch(err){ toast(err.message,'error'); }
    setCreating(false);
  };

  const createSolo = async () => {
    if (!soloForm.title.trim()) { toast('Enter a title!','error'); return; }
    if (soloAvailable===0) { toast('No questions match filters!','error'); return; }
    setCreating(true);
    try {
      const res = await api.createSession({
        title: soloForm.title.trim(),
        teams: [],
        timerSeconds: soloForm.timerSeconds,
        diffFilter: soloForm.diffFilter,
        topicFilter: soloForm.selectedTopics,
        questionsPerTeam: soloForm.questionsPerRound,
        mode: 'individual',
        maxPlayers: soloForm.maxPlayers,
      });
      toast(`Solo session created! Code: ${res.session.code} 🎉`, 'success');
      setShowSoloCreate(false);
      setSoloForm({ title:'', timerSeconds:30, diffFilter:'all', selectedTopics:[], questionsPerRound:10, maxPlayers:40 });
      onRefresh();
    } catch(err){ toast(err.message,'error'); }
    setCreating(false);
  };

  const del = async code => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    try { await api.deleteSession(code); onRefresh(); toast('Session deleted ✅','info'); } catch(err){ toast(err.message,'error'); }
  };

  return (
    <div>
      <div className="fl fla flb mb3" style={{flexWrap:'wrap',gap:8}}>
        <h2 style={{fontSize:'1.5rem'}}>🎮 Sessions</h2>
        <div className="fl gap2">
          <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}>👥 + Team Session</button>
          <button className="btn btn-sm" style={{background:'linear-gradient(135deg,#4CAF50,#00D4AA)',color:'#fff',border:'none'}} onClick={()=>setShowSoloCreate(true)}>🏅 + Solo Session</button>
        </div>
      </div>
      {sessions.length===0 ? (
        <div className="empty card"><div style={{fontSize:'2.5rem',marginBottom:10}}>🎮</div><p className="fw8 mb2">No sessions yet</p>
          <button className="btn btn-primary mt3" onClick={()=>setShowCreate(true)}>Create First Session</button></div>
      ) : sessions.map(s=>(
        <div key={s.code} className="card card-glow" style={{marginBottom:12}}>
          <div className="fl fla flb mb3">
            <div>
              <div className="fw8" style={{fontSize:'1.15rem'}}>{s.title}</div>
              <div className="fl fla gap2 mt1" style={{flexWrap:'wrap',marginTop:6}}>
                <span className={`badge diff-${s.diffFilter}`}>{s.diffFilter==='all'?'All Levels':s.diffFilter}</span>
                <span className="badge b-purple">{s.questionCount} q</span>
                <span className="badge b-orange">{s.timerSeconds}s</span>
                <span className={`badge b-${s.status==='playing'?'red':s.status==='finished'?'green':'blue'}`}>{s.status}</span>
                    {s.mode==='individual'&&<span className="badge" style={{background:'rgba(76,175,80,.2)',color:'var(--green)',border:'1px solid rgba(76,175,80,.4)'}}>🏅 Solo</span>}{s.maxPlayers&&<span className="badge b-purple" style={{fontSize:'0.75rem'}}>Max {s.maxPlayers}</span>}
              </div>
            </div>
            <div className="fl gap2">
              {s.status!=='finished' && <button className="btn btn-green btn-sm" onClick={()=>onControl(s.code)}>🎮 Control</button>}
              {s.status==='finished' && onViewResults && <button className="btn btn-sm" style={{background:'rgba(79,140,255,.2)',color:'var(--blue)',border:'1px solid rgba(79,140,255,.4)'}} onClick={onViewResults}>📊 Results</button>}
              <button className="btn btn-danger btn-sm" onClick={()=>del(s.code)}>🗑️</button>
            </div>
          </div>
          <div style={{background:'var(--bg3)',borderRadius:12,padding:'12px 16px',textAlign:'center',border:'2px dashed rgba(123,97,255,.45)',marginBottom:12}}>
            <div className="mut fs-xs fw8" style={{letterSpacing:2,marginBottom:6}}>GAME CODE</div>
            <div style={{fontFamily:'Fredoka,cursive',fontSize:'2.6rem',fontWeight:700,letterSpacing:12,background:'linear-gradient(135deg,var(--blue),var(--blue2))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{s.code}</div>
            <p className="mut fs-xs mt1">{s.mode==='individual'?'Students enter this code to join as individual solo players':'All teams enter this code — they choose their team on the join screen'}</p>
          </div>
          <div className="fl flw gap2">{s.teams.map(t=>(
            <div key={t.id} style={{padding:'5px 10px',borderRadius:9,background:`${t.color}18`,border:`1.5px solid ${t.color}55`,display:'flex',alignItems:'center',gap:6}}>
              <span>{t.emoji}</span><span className="fw8 fs-xs" style={{color:t.color}}>{t.name}</span>
              <span className="badge b-purple" style={{fontSize:'0.72rem'}}>{t.playerCount}</span>
            </div>
          ))}</div>
        </div>
      ))}

      <Modal show={showCreate} onClose={()=>setShowCreate(false)} wide>
        <h3 style={{fontSize:'1.2rem',marginBottom:18}}>🎮 Create New Session</h3>
        <div className="fg"><label className="lbl">Session Title</label>
          <input className="inp" placeholder="e.g. Grade 9 Science Battle" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
        </div>
        <div className="grid2 mb3" style={{gap:12,marginBottom:14}}>
          <div className="fg" style={{margin:0}}><label className="lbl">Difficulty</label>
            <select className="inp" value={form.diffFilter} onChange={e=>setForm(p=>({...p,diffFilter:e.target.value}))}>
              <option value="all">🎯 All Levels</option><option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option>
            </select>
          </div>
          <div className="fg" style={{margin:0}}><label className="lbl">Timer: <strong>{form.timerSeconds}s</strong></label>
            <input type="range" min={5} max={120} step={5} value={form.timerSeconds} onChange={e=>setForm(p=>({...p,timerSeconds:+e.target.value}))} style={{width:'100%',marginTop:14,accentColor:'var(--blue)'}}/>
          </div>
        </div>
        <div className="fg" style={{background:'rgba(79,140,255,.08)',border:'1px solid rgba(79,140,255,.25)',borderRadius:12,padding:'12px 16px',marginBottom:14}}>
          <label className="lbl" style={{color:'var(--blue)'}}>Questions Per Team</label>
          <div className="grid3 gap2" style={{marginTop:8}}>
            {[5,8,10,12,15].map(n=>(
              <button key={n} onClick={()=>setForm(p=>({...p,questionsPerTeam:n}))} className="btn btn-sm"
                style={{background:form.questionsPerTeam===n?'var(--blue)':'var(--bg3)',border:`1.5px solid ${form.questionsPerTeam===n?'var(--blue)':'rgba(255,255,255,.1)'}`,color:form.questionsPerTeam===n?'#fff':'var(--t2)'}}>
                {n}
              </button>
            ))}
          </div>
          <p className="mut fs-xs mt1" style={{marginTop:6}}>Each team picks {form.questionsPerTeam} topics · Total rounds ≈ {form.questionsPerTeam * form.teamCount}</p>
        </div>
        <div className="fg" style={{background:'rgba(123,97,255,.08)',border:'1px solid rgba(123,97,255,.25)',borderRadius:12,padding:'12px 16px',marginBottom:14}}>
          <label className="lbl" style={{color:'var(--blue2)'}}>Max Players (across all teams combined)</label>
          <div className="grid3 gap2" style={{marginTop:8}}>
            {[10,15,25,40,60,100].map(n=>(
              <button key={n} onClick={()=>setForm(p=>({...p,maxPlayers:n}))} className="btn btn-sm"
                style={{background:form.maxPlayers===n?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${form.maxPlayers===n?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:form.maxPlayers===n?'#fff':'var(--t2)'}}>
                {n}
              </button>
            ))}
          </div>
          <p className="mut fs-xs mt1" style={{marginTop:6}}>Once {form.maxPlayers} players have joined (any team), the game code stops accepting new joins.</p>
        </div>
        <div className="fg"><label className="lbl">Filter Topics <span className="mut">(empty = all)</span></label>
          <div className="fl flw gap2">
            {topics.map(t=>{
              const meta=topicMeta[t]; const cnt=dbQuestions.filter(q=>q.topic===t&&(form.diffFilter==='all'||q.diff===form.diffFilter)).length;
              return (<button key={t} onClick={()=>toggleTopic(t)} className="btn btn-sm"
                style={{background:form.selectedTopics.includes(t)?`${meta.color}33`:'var(--bg3)',border:`1.5px solid ${form.selectedTopics.includes(t)?meta.color:'rgba(255,255,255,.1)'}`,color:form.selectedTopics.includes(t)?'#fff':'var(--t2)'}}>
                {meta.emoji} {t} ({cnt})
              </button>);
            })}
          </div>
        </div>
        <div style={{padding:'8px 14px',borderRadius:10,background:available>0?'rgba(76,175,80,.08)':'rgba(255,82,82,.08)',border:`1px solid ${available>0?'rgba(76,175,80,.25)':'rgba(255,82,82,.25)'}`,marginBottom:14}}>
          <span className={`fw8 fs-sm ${available>0?'grn':'rdc'}`}>{available>0?'✅':'❌'} {available} questions match</span>
        </div>
        <div className="fg"><label className="lbl">Teams</label>
          <div className="grid3 gap2 mb2" style={{marginBottom:10}}>
            {[2,3,4,5,6].map(n=>(<button key={n} onClick={()=>setTeamCount(n)} className="btn btn-sm"
              style={{background:form.teamCount===n?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${form.teamCount===n?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:form.teamCount===n?'#fff':'var(--t2)'}}>{n}</button>))}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {form.teams.map((t,i)=>(
              <div key={t.id} className="fl fla gap2">
                <input type="text" value={t.emoji} maxLength={2} onChange={e=>updateTeam(i,'emoji',e.target.value)} style={{width:44,background:'var(--bg3)',border:'1.5px solid rgba(255,255,255,.1)',borderRadius:10,padding:'8px',color:'var(--t1)',textAlign:'center',fontSize:'1.2rem'}}/>
                <input className="inp fl1" value={t.name} onChange={e=>updateTeam(i,'name',e.target.value)} placeholder={`Team ${t.id}`}/>
                <input type="color" value={t.color} onChange={e=>updateTeam(i,'color',e.target.value)} style={{width:40,height:40,border:'none',background:'none',cursor:'pointer',borderRadius:8}}/>
              </div>
            ))}
          </div>
        </div>
        <div className="fl gap2 mt3" style={{marginTop:14}}>
          <button className="btn btn-primary fl1" onClick={create} disabled={creating||available===0}>{creating?'⏳ Creating…':'🚀 Create & Get Code'}</button>
          <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Cancel</button>
        </div>
      </Modal>

      {/* ── SOLO SESSION CREATE MODAL ── */}
      <Modal show={showSoloCreate} onClose={()=>setShowSoloCreate(false)} wide>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <span style={{fontSize:'2rem'}}>🏅</span>
          <div>
            <h3 style={{fontSize:'1.2rem',marginBottom:2}}>Create Solo Player Session</h3>
            <p className="mut fs-xs">Each student joins individually and competes by name — no teams.</p>
          </div>
        </div>
        <div className="fg"><label className="lbl">Session Title</label>
          <input className="inp" placeholder="e.g. Class 9 Quiz — Solo" value={soloForm.title} onChange={e=>setSoloForm(p=>({...p,title:e.target.value}))}/>
        </div>
        <div className="grid2 mb3" style={{gap:12,marginBottom:14}}>
          <div className="fg" style={{margin:0}}><label className="lbl">Difficulty</label>
            <select className="inp" value={soloForm.diffFilter} onChange={e=>setSoloForm(p=>({...p,diffFilter:e.target.value}))}>
              <option value="all">🎯 All Levels</option>
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
            </select>
          </div>
          <div className="fg" style={{margin:0}}><label className="lbl">Timer: <strong>{soloForm.timerSeconds}s</strong></label>
            <input type="range" min={5} max={120} step={5} value={soloForm.timerSeconds} onChange={e=>setSoloForm(p=>({...p,timerSeconds:+e.target.value}))} style={{width:'100%',marginTop:14,accentColor:'var(--green)'}}/>
          </div>
        </div>
        <div className="fg" style={{background:'rgba(76,175,80,.08)',border:'1px solid rgba(76,175,80,.25)',borderRadius:12,padding:'12px 16px',marginBottom:14}}>
          <label className="lbl" style={{color:'var(--green)'}}>Questions Per Round</label>
          <div className="grid3 gap2" style={{marginTop:8}}>
            {[5,8,10,12,15].map(n=>(
              <button key={n} onClick={()=>setSoloForm(p=>({...p,questionsPerRound:n}))} className="btn btn-sm"
                style={{background:soloForm.questionsPerRound===n?'var(--green)':'var(--bg3)',border:`1.5px solid ${soloForm.questionsPerRound===n?'var(--green)':'rgba(255,255,255,.1)'}`,color:soloForm.questionsPerRound===n?'#fff':'var(--t2)'}}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="fg" style={{background:'rgba(123,97,255,.08)',border:'1px solid rgba(123,97,255,.25)',borderRadius:12,padding:'12px 16px',marginBottom:14}}>
          <label className="lbl" style={{color:'var(--blue2)'}}>Max Players Allowed</label>
          <div className="grid3 gap2" style={{marginTop:8}}>
            {[20,40,60,80,100].map(n=>(
              <button key={n} onClick={()=>setSoloForm(p=>({...p,maxPlayers:n}))} className="btn btn-sm"
                style={{background:soloForm.maxPlayers===n?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${soloForm.maxPlayers===n?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:soloForm.maxPlayers===n?'#fff':'var(--t2)'}}>
                {n}
              </button>
            ))}
          </div>
          <p className="mut fs-xs" style={{marginTop:6}}>Once {soloForm.maxPlayers} players join, the game will reject new entries.</p>
        </div>
        <div className="fg"><label className="lbl">Filter Topics <span className="mut">(empty = all)</span></label>
          <div className="fl flw gap2">
            {topics.map(t=>{
              const meta=topicMeta[t]; const cnt=dbQuestions.filter(q=>q.topic===t&&(soloForm.diffFilter==='all'||q.diff===soloForm.diffFilter)).length;
              return (<button key={t} onClick={()=>toggleSoloTopic(t)} className="btn btn-sm"
                style={{background:soloForm.selectedTopics.includes(t)?`${meta.color}33`:'var(--bg3)',border:`1.5px solid ${soloForm.selectedTopics.includes(t)?meta.color:'rgba(255,255,255,.1)'}`,color:soloForm.selectedTopics.includes(t)?'#fff':'var(--t2)'}}>
                {meta.emoji} {t} ({cnt})
              </button>);
            })}
          </div>
        </div>
        <div style={{padding:'8px 14px',borderRadius:10,background:soloAvailable>0?'rgba(76,175,80,.08)':'rgba(255,82,82,.08)',border:`1px solid ${soloAvailable>0?'rgba(76,175,80,.25)':'rgba(255,82,82,.25)'}`,marginBottom:14}}>
          <span className={`fw8 fs-sm ${soloAvailable>0?'grn':'rdc'}`}>{soloAvailable>0?'✅':'❌'} {soloAvailable} questions match</span>
        </div>
        <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(76,175,80,.08)',border:'1px solid rgba(76,175,80,.2)',marginBottom:14,fontSize:'0.9rem',color:'var(--green)'}}>
          🏅 In Solo mode, each student joins individually. No team selection — everyone competes by name.
        </div>
        <button className="btn btn-block btn-lg" style={{background:'linear-gradient(135deg,#4CAF50,#00D4AA)',color:'#fff',border:'none'}}
          onClick={createSolo} disabled={creating||soloAvailable===0}>
          {creating?'⏳ Creating…':'🏅 Create Solo Session & Get Code'}
        </button>
      </Modal>
    </div>
  );
}

// ─── LIVE CONTROL ────────────────────────────────────────────────────────────
function LiveControl({ emit, toast, topicMeta, onNavigate, onRefresh }) {
  const { state, dispatch } = useApp();
  const gs = state.gameState;
  const [newTimer, setNewTimer] = useState(30);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{ if(gs?.timerSeconds) setNewTimer(gs.timerSeconds); },[gs?.timerSeconds]);

  if (!gs) return (
    <div className="empty"><div style={{fontSize:'2.5rem',marginBottom:10}}>🎮</div>
      <p className="fw8">No active session</p><p className="fs-sm mt1">Sessions → click <strong>Control</strong></p></div>
  );

  const act = async (event, data={}) => {
    setBusy(true);
    try { await emit(event, { code:gs.code, ...data }); }
    catch(e){ toast(e.message,'error'); }
    setBusy(false);
  };

  const q           = gs.question;
  const currentTeam = gs.teams?.find(t=>t.id===gs.currentTeamId);
  const sorted      = gs.teams ? [...gs.teams].sort((a,b)=>b.score-a.score) : [];
  const available   = gs.availableTopics||[];
  const statusColor = {playing:'var(--green)',lobby:'var(--blue)',topic_pick:'var(--yellow)',round_result:'var(--orange)',finished:'var(--t2)'}[gs.status]||'var(--t2)';

  // Individual (solo) mode helpers
  const isIndividual   = gs.mode === 'individual';
  const maxRounds      = gs.maxRounds || (isIndividual ? (gs.questionsPerTeam || 5) : (gs.questionsPerTeam || 10) * (gs.teams?.length || 1));
  const roundsDone     = gs.roundNumber || 0;
  // Use server-computed gameOver flag — covers both team round-limit and solo limit correctly
  // Falls back to client-side calculation for resilience
  const isGameOver     = gs.status === 'finished'
    || gs.gameOver === true
    || available.length === 0
    || (isIndividual && roundsDone >= maxRounds && gs.status === 'round_result')
    || (!isIndividual && roundsDone >= maxRounds && gs.status === 'round_result');
  // Label for the next-round button
  const nextBtnLabel   = isGameOver ? '🏁 Show Final Results' : isIndividual ? '➡️ Next Question' : '➡️ Next Team Picks';

  return (
    <div style={{maxWidth:860}}>
      <div className="fl fla flb mb3">
        <h2 style={{fontSize:'1.5rem'}}>🔴 Live — {gs.title}</h2>
        <span className="badge" style={{background:`${statusColor}22`,color:statusColor,border:`1px solid ${statusColor}55`,fontSize:'0.88rem',padding:'5px 12px'}}>
          {gs.status==='topic_pick'?'🎯 PICKING':gs.status?.toUpperCase().replace('_',' ')}
        </span>
      </div>
      <div style={{background:'var(--bg3)',borderRadius:12,padding:'10px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span className="mut fs-sm">Code:</span>
        <span style={{fontFamily:'Fredoka,cursive',fontSize:'1.4rem',fontWeight:700,letterSpacing:8,color:'var(--blue)'}}>{gs.code}</span>
        <span className="mut fs-xs">· {gs.teams?.reduce((a,t)=>a+t.playerCount,0)||0} students</span>
        <span className="mut fs-xs">· Round {gs.roundNumber||0} · {gs.usedCount||0}/{gs.totalQuestions} used</span>
        <span className="mut fs-xs">· {available.length} topics left</span>
      </div>
      <div style={{
        background: gs.doublePoints ? 'linear-gradient(135deg,rgba(255,217,61,.18),rgba(255,140,66,.18))' : 'var(--bg3)',
        border: gs.doublePoints ? '1.5px solid rgba(255,217,61,.5)' : '1px solid rgba(255,255,255,.06)',
        borderRadius:12, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
      }}>
        <span className="fw8 fs-sm">⚡ Double Points</span>
        <span className="mut fs-xs">
          {gs.doublePoints ? 'Armed — next question picked will be worth 2x' :
           gs.doublePointsActive ? 'Active on the current question' :
           'Off — arm it before ' + (isIndividual ? 'the next question' : 'a team picks their next topic')}
        </span>
        <button
          className={`btn btn-sm ${gs.doublePoints ? '' : 'btn-ghost'}`}
          style={gs.doublePoints ? {background:'linear-gradient(135deg,var(--yellow),var(--orange))',color:'#1a1a1a'} : {}}
          disabled={busy || gs.status !== 'topic_pick'}
          onClick={()=>act('toggle-double-points',{on:!gs.doublePoints})}
          title={gs.status !== 'topic_pick' ? 'Only available between questions' : ''}
        >
          {gs.doublePoints ? '✅ Armed — tap to cancel' : '⚡ Arm for next question'}
        </button>
      </div>
      <div className="grid2" style={{gap:14,marginBottom:14}}>
        <div className="card">
          {gs.mode === 'individual' ? (
            <>
              <div className="sec-title">🏅 Player List — Live Scores ({(gs.individualPlayers||[]).length} players)</div>
              {(gs.individualPlayers||[]).length === 0
                ? <p className="mut fs-sm">Waiting for players to join…</p>
                : (
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.92rem'}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                        <th style={{textAlign:'left',padding:'5px 6px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>#</th>
                        <th style={{textAlign:'left',padding:'5px 6px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Player Name</th>
                        <th style={{textAlign:'right',padding:'5px 6px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(gs.individualPlayers||[])].sort((a,b)=>b.score-a.score).map((p,i)=>(
                        <tr key={p.socketId||p.name} style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                          <td style={{padding:'6px 6px',color:'var(--t3)',fontWeight:700,fontSize:'0.88rem'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                          <td style={{padding:'6px 6px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <span style={{fontSize:'1.15rem'}}>{p.avatar||'🦁'}</span>
                              <span className="fw8 fs-sm">{p.name}</span>
                            </div>
                          </td>
                          <td style={{padding:'6px 6px',textAlign:'right',fontWeight:900,color:'var(--green)'}}>{p.score||0} <span className="mut" style={{fontSize:'0.82rem',fontWeight:400}}>pts</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </>
          ) : (
            <>
              <div className="sec-title">📊 Scores</div>
              {sorted.map((t,i)=><TeamScoreRow key={t.id} team={t} rank={i+1} highlight={t.id===currentTeam?.id}/>)}
            </>
          )}
          {gs.mode !== 'individual' && currentTeam&&(gs.status==='playing'||gs.status==='topic_pick')&&(
            <div style={{marginTop:10,padding:'8px 12px',borderRadius:10,background:`${currentTeam.color}22`,border:`1.5px solid ${currentTeam.color}55`,display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:'1.2rem'}}>{currentTeam.emoji}</span>
              <span className="fw8 fs-sm" style={{color:currentTeam.color}}>{gs.status==='topic_pick'?`${currentTeam.name} is choosing…`:`${currentTeam.name} answering`}</span>
            </div>
          )}
          {gs.mode === 'individual' && (
            <div style={{marginTop:10,padding:'8px 12px',borderRadius:10,background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.3)'}}>
              <span className="fw8 fs-sm" style={{color:'var(--green)'}}>🏅 Solo mode — all students answer simultaneously</span>
            </div>
          )}
        </div>
        <div className="card">
          {gs.status==='lobby'&&<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:'2rem',marginBottom:8}}>⏳</div>
            <p className="fw8 fs-sm">{gs.mode==='individual'?'🏅 Solo Mode — Waiting for students':'👥 Team Mode — Waiting for students'}</p>
            <div className="fl flw flc gap2 mt3" style={{marginTop:10}}>
              {gs.mode==='individual'
                ? (gs.individualPlayers||[]).map((p,i)=>(<div key={p.socketId||i} style={{padding:'4px 10px',borderRadius:8,background:'rgba(76,175,80,.12)',border:'1px solid rgba(76,175,80,.3)',display:'flex',alignItems:'center',gap:5}}>
                    <span>{p.avatar||'🦁'}</span><span className="fw8 fs-xs" style={{color:'var(--green)'}}>{p.name}</span>
                  </div>))
                : gs.teams?.map(t=>(<div key={t.id} style={{padding:'4px 10px',borderRadius:8,background:`${t.color}18`,border:`1.5px solid ${t.color}55`,display:'flex',alignItems:'center',gap:5}}>
                    <span>{t.emoji}</span><span className="fw8 fs-xs" style={{color:t.color}}>{t.name}</span>
                    <span className="badge b-purple" style={{fontSize:'0.72rem'}}>{t.playerCount}</span>
                  </div>))
              }
            </div>
          </div>}
          {gs.status==='topic_pick'&&(
            <div>
              <div className="sec-title">🎯 Available Topics</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {Object.entries(topicMeta).map(([name,meta])=>{
                  const avail=available.includes(name);
                  return (<div key={name} style={{padding:'7px 10px',borderRadius:10,display:'flex',alignItems:'center',gap:7,background:avail?`${meta.color}18`:'rgba(255,255,255,.03)',border:`1.5px solid ${avail?meta.color+'55':'rgba(255,255,255,.06)'}`,opacity:avail?1:.35}}>
                    <span>{meta.emoji}</span><span className="fw8 fs-xs" style={{color:avail?meta.color:'var(--t3)'}}>{name}</span>
                    {!avail&&<span className="fs-xs" style={{marginLeft:'auto',color:'var(--green)'}}>✓ Done</span>}
                  </div>);
                })}
              </div>
            </div>
          )}
          {gs.status==='playing'&&gs.individualAnswers&&Object.keys(gs.individualAnswers||{}).length>0&&(
            <div style={{marginBottom:10,padding:'10px 14px',borderRadius:12,background:'rgba(79,140,255,.08)',border:'1px solid rgba(79,140,255,.2)'}}>
              <div className="sec-title" style={{margin:'0 0 8px',fontSize:'0.9rem'}}>🏅 Individual Answers</div>
              {Object.values(gs.individualAnswers||{}).map((a,i)=>(
                <div key={i} className="fl fla gap2" style={{padding:'4px 0'}}>
                  <span style={{fontSize:'1.05rem'}}>{a.avatar||'🦁'}</span>
                  <span className="fw8 fs-xs fl1">{a.playerName}</span>
                  <span className={`badge ${a.correct?'b-green':'b-red'}`} style={{fontSize:'0.75rem'}}>{a.correct?`✅ +${a.totalChange}`:`❌ ${a.totalChange}`}</span>
                  <span className="mut fs-xs">{a.newScore} pts</span>
                </div>
              ))}
            </div>
          )}
          {(gs.status==='playing'||gs.status==='round_result')&&q&&(
            <div>
              <div className="fl fla flb mb2">
                <div className="sec-title" style={{margin:0}}>{getTopicEmoji(q.topic,topicMeta)} {q.topic}</div>
                {gs.status==='playing'&&<TimerRing value={gs.timerRemaining||0} max={gs.timerSeconds||30} size={48}/>}
              </div>
              <div className="fl fla gap2 mb2">
                <span className={`badge diff-${q.diff}`}>{q.diff}</span>
                <span className="badge b-green fs-xs">✅ +{DIFF_PTS[q.diff]?.correct}</span>
                <span className="badge b-red fs-xs">❌ -{DIFF_PTS[q.diff]?.wrong}</span>
              </div>
              <div style={{fontSize:'1.05rem',fontWeight:800,lineHeight:1.5,marginBottom:10}}>{q.text}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {q.opts?.map((o,i)=>{ const ok=gs.status==='round_result'&&q.ans?.includes(i); return (
                  <div key={i} style={{padding:'7px 10px',borderRadius:9,fontSize:'0.88rem',fontWeight:700,display:'flex',alignItems:'center',gap:7,background:ok?'rgba(76,175,80,.15)':'rgba(255,255,255,.04)',border:`1.5px solid ${ok?'rgba(76,175,80,.5)':'rgba(255,255,255,.08)'}`}}>
                    <span style={{width:24,height:24,borderRadius:'50%',background:ok?'var(--green)':'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:900,color:ok?'#fff':'var(--t2)',flexShrink:0}}>{LETTERS[i]}</span>
                    {o}{ok&&<span style={{marginLeft:'auto'}}>✅</span>}
                  </div>
                );})}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="sec-title">⚙️ Controls</div>
        <div className="fl flw gap2 mb3" style={{marginBottom:12}}>
          {/* FINISHED STATE — game completed, show navigation options */}
          {gs.status==='finished' && (
            <div style={{width:'100%'}}>
              <div style={{padding:'20px 16px',borderRadius:12,background:'rgba(76,175,80,.08)',border:'2px solid rgba(76,175,80,.35)',textAlign:'center',marginBottom:12}}>
                <div style={{fontSize:'2.5rem',marginBottom:8}}>🏁</div>
                <div className="fw8 fs-lg" style={{color:'var(--green)',marginBottom:4}}>Game Completed!</div>
                <div className="mut fs-sm">All questions have been answered. What would you like to do next?</div>
              </div>
              <div className="fl gap2">
                <button
                  className="btn btn-ghost fl1"
                  onClick={() => {
                    dispatch({ type:'SET_GAME', gameState: null });
                    dispatch({ type:'SET_ROUND', roundResult: null });
                    dispatch({ type:'SET_LEADERBOARD', leaderboard: null });
                    dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: [] });
                    onRefresh && onRefresh();
                    onNavigate('sessions');
                  }}
                >
                  🔄 Replay / New Session
                </button>
                <button
                  className="btn btn-primary fl1"
                  onClick={() => {
                    dispatch({ type:'SET_GAME', gameState: null });
                    dispatch({ type:'SET_ROUND', roundResult: null });
                    dispatch({ type:'SET_LEADERBOARD', leaderboard: null });
                    dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: [] });
                    onRefresh && onRefresh();
                    onNavigate('dashboard');
                  }}
                >
                  🏠 Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* LOBBY — start game */}
          {gs.status==='lobby' && (
            <>
              <button className="btn btn-green btn-block" onClick={()=>{
                if(!gs.teams?.some(t=>t.playerCount>0)){toast('⚠️ No students have joined yet!','error');return;}
                act('start-game');
              }} disabled={busy}>{busy?'⏳':'🚀 Start Game'}</button>
              {!gs.teams?.some(t=>t.playerCount>0) && (
                <p className="mut fs-xs" style={{marginTop:6,textAlign:'center',color:'var(--yellow)'}}>⚠️ Waiting for at least 1 student to join</p>
              )}
            </>
          )}

          {/* PLAYING — timer controls */}
          {gs.status==='playing' && <>
            <button className="btn btn-ghost fl1" onClick={()=>act('pause-timer')} disabled={!gs.timerRunning||busy}>⏸ Pause</button>
            <button className="btn btn-ghost fl1" onClick={()=>act('resume-timer')} disabled={gs.timerRunning||busy}>▶ Resume</button>
            <button className="btn btn-yellow fl1" onClick={()=>act('skip-question')} disabled={busy}>⏭ Skip</button>
          </>}

          {/* ROUND RESULT — advance to next or show final results */}
          {gs.status==='round_result' && (
            <button
              className={`btn btn-block ${isGameOver ? 'btn-green' : 'btn-primary'}`}
              onClick={()=>act('next-round')}
              disabled={busy}
              style={isGameOver ? {background:'linear-gradient(135deg,#4CAF50,#00D4AA)',border:'none'} : {}}
            >
              {busy ? '⏳' : nextBtnLabel}
            </button>
          )}

          {/* TOPIC PICK — waiting message */}
          {gs.status==='topic_pick' && (
            <div style={{width:'100%',padding:'10px 14px',borderRadius:12,background:'rgba(255,217,61,.08)',border:'1px solid rgba(255,217,61,.3)',textAlign:'center'}}>
              <span className="fw8 fs-sm" style={{color:'var(--yellow)'}}>
                {isIndividual ? '⏳ Waiting for a student to pick a topic…' : `⏳ Waiting for ${currentTeam?.name} to pick…`}
              </span>
            </div>
          )}
        </div>

        {/* Timer controls — hide when game is finished */}
        {gs.status !== 'finished' && (
          <div>
            <label className="lbl">TIMER: <strong>{newTimer}s</strong></label>
            <div className="grid3 gap2 mt1" style={{marginTop:8}}>
              {[10,15,20,30,45,60].map(v=>(<button key={v} onClick={()=>setNewTimer(v)} className="btn btn-sm"
                style={{background:newTimer===v?'var(--blue2)':'var(--bg3)',border:`1px solid ${newTimer===v?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:newTimer===v?'#fff':'var(--t2)'}}>{v}s</button>))}
            </div>
            <button className="btn btn-ghost btn-sm mt2" style={{marginTop:8}} onClick={()=>act('set-timer',{seconds:newTimer})} disabled={busy}>Apply</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MEDIA PREVIEW HELPER ────────────────────────────────────────────────────
function MediaPreview({ url, type }) {
  if (!url) return null;
  const isYouTube = /youtube\.com|youtu\.be/.test(url);
  const getYTEmbed = (u) => {
    const m = u.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : u;
  };
  return (
    <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.3)' }}>
      {type === 'image' && (
        <img src={url} alt="Question media" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }} onError={e => e.target.style.display='none'} />
      )}
      {type === 'video' && !isYouTube && (
        <video src={url} controls style={{ width: '100%', maxHeight: 220 }} />
      )}
      {(type === 'video' || type === 'youtube') && isYouTube && (
        <iframe src={getYTEmbed(url)} title="YouTube video" style={{ width: '100%', height: 200, border: 'none' }} allowFullScreen />
      )}
    </div>
  );
}

// ─── QUIZ BUILDER ────────────────────────────────────────────────────────────
const EMPTY_FORM = { q:'', opts:['','','',''], ans:[], exp:'', topic:'Math', diff:'easy', mediaUrl:'', mediaType:'none' };

function Builder({ toast, dbQuestions, setDbQuestions, topics, topicMeta }) {
  const [form,       setForm]       = useState({ ...EMPTY_FORM, topic: topics[0]||'Math' });
  const [saving,      setSaving]      = useState(false);
  const [editBankId,   setEditBankId]   = useState(null);
  const [tab,        setTab]        = useState('create');
  const [filter,     setFilter]     = useState({ topic:'All', diff:'all' });
  const [mediaMode,  setMediaMode]  = useState('url'); // 'url' | 'upload'
  const [uploading,  setUploading]  = useState(false);

  const isEditing = editBankId !== null;

  const toggleAns = i => setForm(p=>({...p,ans:p.ans.includes(i)?p.ans.filter(x=>x!==i):[...p.ans,i]}));
  const setOpt    = (i,v) => setForm(p=>{const o=[...p.opts];o[i]=v;return{...p,opts:o};});
  const addOpt    = () => { if(form.opts.length>=6){toast('Max 6!','error');return;} setForm(p=>({...p,opts:[...p.opts,'']})); };
  const removeOpt = i => setForm(p=>({...p,opts:p.opts.filter((_,x)=>x!==i),ans:p.ans.filter(a=>a!==i).map(a=>a>i?a-1:a)}));

  const clearForm = () => { setForm({...EMPTY_FORM, topic:form.topic}); setEditBankId(null); };

  // Detect media type from URL
  const detectMediaType = (url) => {
    if (!url) return 'none';
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) return 'image';
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return 'video';
    return 'none';
  };

  const handleMediaUrlChange = (url) => {
    const detectedType = detectMediaType(url);
    setForm(p => ({ ...p, mediaUrl: url, mediaType: detectedType }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = /^image\/(jpeg|png|webp)$/.test(file.type);
    const isVideo = /^video\/(mp4|webm)$/.test(file.type);
    if (!isImage && !isVideo) { toast('Only JPG, PNG, WebP, MP4, WebM allowed', 'error'); return; }
    const maxMB = isImage ? 10 : 50;
    if (file.size > maxMB * 1024 * 1024) { toast(`File too large. Max ${maxMB}MB`, 'error'); return; }
    setUploading(true);
    try {
      // Convert to base64 data URL for local preview (replace with cloud upload URL in production)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        setForm(p => ({ ...p, mediaUrl: dataUrl, mediaType: isImage ? 'image' : 'video' }));
        toast('Media loaded ✅', 'success');
        setUploading(false);
      };
      reader.onerror = () => { toast('Failed to read file', 'error'); setUploading(false); };
      reader.readAsDataURL(file);
    } catch(_) { toast('Upload failed', 'error'); setUploading(false); }
  };

  const saveQ = async () => {
    if (!form.q.trim())              { toast('Enter a question!','error'); return; }
    if (form.ans.length===0)         { toast('Mark at least one correct answer ✓','error'); return; }
    if (form.opts.some(o=>!o.trim())){ toast('Fill all options!','error'); return; }
    const pts = form.diff==='easy'?100:form.diff==='medium'?150:200;
    const mediaUrl  = form.mediaUrl?.trim() || null;
    const mediaType = mediaUrl ? (form.mediaType && form.mediaType !== 'none' ? form.mediaType : detectMediaType(mediaUrl)) : null;

    if (editBankId !== null) {
      // ── UPDATE PUBLISHED QUESTION ──
      const updatedQ = { ...form, pts, opts:[...form.opts], ans:[...form.ans], id: editBankId, mediaUrl, mediaType };
      setSaving(true);
      try {
        await api.updateQuestion(editBankId, updatedQ);
        setDbQuestions(prev => prev.map(q => q.id === editBankId ? updatedQ : q));
        toast('Question updated ✅', 'success');
        clearForm();
      } catch(err) { toast(err.message, 'error'); }
      setSaving(false);
      return;
    }

    // ── CREATE NEW QUESTION ──
    // This used to only stage the question in local component state until a
    // separate, easy-to-miss "Publish All" button was clicked — so a question
    // could look "saved" without ever reaching the bank/Topics counts, and
    // navigating away lost it entirely. Saving now always writes straight
    // through to the bank, the same way editing already did, so what you see
    // in the form is exactly what's in the bank and on the Topics page.
    const nq = { id: 'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,7), ...form, pts, opts:[...form.opts], ans:[...form.ans], mediaUrl, mediaType };
    setSaving(true);
    try {
      await api.addQuestion(nq);
      setDbQuestions(prev => [...prev, nq]);
      toast('Question added to bank ✅', 'success');
      clearForm();
    } catch(err) { toast(err.message, 'error'); }
    setSaving(false);
  };

  const deleteFromBank = async (id) => {
    try { await api.deleteQuestion(id); } catch(_){}
    setDbQuestions(prev=>prev.filter(q=>q.id!==id));
    toast('Deleted','info');
  };

  // Load a published (bank) question into the form for editing
  const editBankQuestion = (q) => {
    setForm({ q:q.q, opts:[...q.opts], ans:[...q.ans], exp:q.exp||'', topic:q.topic, diff:q.diff, mediaUrl:q.mediaUrl||'', mediaType:q.mediaType||'none' });
    setEditBankId(q.id);
    setTab('create');
  };

  const filtered = dbQuestions.filter(q=>{
    if (filter.topic!=='All'&&q.topic!==filter.topic) return false;
    if (filter.diff!=='all'&&q.diff!==filter.diff)    return false;
    return true;
  });

  const previewType = form.mediaUrl ? (form.mediaType && form.mediaType !== 'none' ? form.mediaType : detectMediaType(form.mediaUrl)) : null;

  return (
    <div style={{maxWidth:780}}>
      <h2 style={{fontSize:'1.5rem',marginBottom:6}}>✏️ Quiz Builder</h2>
      <p className="mut fs-sm mb3" style={{marginBottom:18}}>Create questions and add them to the bank. Mentors have full access to add, edit, and remove questions.</p>
      <div className="fl gap2 mb3" style={{marginBottom:18}}>
        {[['create','✏️ Create Question'],['bank',`📚 Question Bank (${dbQuestions.length})`]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} className="btn btn-sm"
            style={{background:tab===id?'var(--blue2)':'var(--bg3)',border:`1.5px solid ${tab===id?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:tab===id?'#fff':'var(--t2)'}}>{lbl}</button>
        ))}
      </div>

      {tab==='create'&&(<>
        {/* Edit mode banner */}
        {isEditing && (
          <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(255,193,7,.1)',border:'1px solid rgba(255,193,7,.4)',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <span>✏️</span>
            <span className="fw8 fs-sm" style={{color:'#FFD93D',flex:1}}>
              Editing published question — changes save straight to the bank.
            </span>
            <button className="btn btn-ghost btn-sm" onClick={clearForm}>✕ Cancel</button>
          </div>
        )}
        <div className="card mb3" style={{marginBottom:14}}>
          <div className="sec-title">📝 Question Details</div>
          <div className="fg"><label className="lbl">Question Text</label>
            <textarea className="inp" rows={3} placeholder="Type your question here…" value={form.q} onChange={e=>setForm(p=>({...p,q:e.target.value}))} style={{marginBottom:12}}/>
          </div>
          <div className="grid2">
            <div className="fg"><label className="lbl">Topic</label>
              <select className="inp" value={form.topic} onChange={e=>setForm(p=>({...p,topic:e.target.value}))}>
                {topics.map(t=><option key={t} value={t}>{getTopicEmoji(t,topicMeta)} {t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="lbl">Difficulty & Points</label>
              <select className="inp" value={form.diff} onChange={e=>setForm(p=>({...p,diff:e.target.value}))}>
                <option value="easy">🟢 Easy — Correct +100 / Wrong −50</option>
                <option value="medium">🟡 Medium — Correct +150 / Wrong −75</option>
                <option value="hard">🔴 Hard — Correct +200 / Wrong −100</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── MEDIA SECTION ── */}
        <div className="card mb3" style={{marginBottom:14}}>
          <div className="fl fla flb flw gap2" style={{marginBottom:10}}>
            <div className="sec-title" style={{margin:0}}>🖼️ Media <span className="mut fs-xs" style={{fontWeight:400}}>— optional image or video</span></div>
            <div className="fl gap2" style={{flexShrink:0}}>
              <button onClick={()=>setMediaMode('url')} className="btn btn-sm"
                style={{background:mediaMode==='url'?'var(--blue2)':'var(--bg3)',border:`1px solid ${mediaMode==='url'?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:mediaMode==='url'?'#fff':'var(--t2)',fontSize:'0.85rem'}}>🔗 URL</button>
              <button onClick={()=>setMediaMode('upload')} className="btn btn-sm"
                style={{background:mediaMode==='upload'?'var(--blue2)':'var(--bg3)',border:`1px solid ${mediaMode==='upload'?'var(--blue2)':'rgba(255,255,255,.1)'}`,color:mediaMode==='upload'?'#fff':'var(--t2)',fontSize:'0.85rem'}}>📁 Upload</button>
            </div>
          </div>

          {mediaMode==='url' && (
            <div className="fg">
              <label className="lbl">Image URL, Video URL, or YouTube Link</label>
              <input className="inp" type="url" placeholder="https:// or youtube.com/watch?v=..." value={form.mediaUrl||''} onChange={e=>handleMediaUrlChange(e.target.value)} />
              <p className="mut fs-xs" style={{marginTop:4}}>Supports: JPG, PNG, WebP images · MP4, WebM videos · YouTube links</p>
            </div>
          )}

          {mediaMode==='upload' && (
            <div className="fg">
              <label className="lbl">Upload File</label>
              <div style={{border:'2px dashed rgba(255,255,255,.2)',borderRadius:10,padding:'18px',textAlign:'center',background:'rgba(255,255,255,.03)',cursor:'pointer',position:'relative'}}
                onClick={()=>document.getElementById('media-upload-input').click()}>
                {uploading
                  ? <><div style={{fontSize:'1.5rem',marginBottom:6}}>⏳</div><p className="mut fs-sm">Loading…</p></>
                  : form.mediaUrl
                    ? <><div style={{fontSize:'1.5rem',marginBottom:6}}>✅</div><p className="mut fs-sm">File loaded. Click to replace.</p></>
                    : <><div style={{fontSize:'1.5rem',marginBottom:6}}>📁</div><p className="mut fs-sm">Click to choose file</p>
                       <p className="mut fs-xs" style={{marginTop:4}}>Images: JPG, PNG, WebP (max 10MB) · Videos: MP4, WebM (max 50MB)</p></>
                }
                <input id="media-upload-input" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" style={{display:'none'}} onChange={handleFileUpload} />
              </div>
            </div>
          )}

          {form.mediaUrl && (
            <div style={{marginTop:10}}>
              <div className="fl fla flb" style={{marginBottom:6}}>
                <span className="mut fs-xs">Preview:</span>
                <button onClick={()=>setForm(p=>({...p,mediaUrl:'',mediaType:'none'}))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:'0.85rem'}}>✕ Remove</button>
              </div>
              <MediaPreview url={form.mediaUrl} type={previewType} />
            </div>
          )}
        </div>

        <div className="card mb3" style={{marginBottom:14}}>
          <div className="fl fla flb mb3">
            <div className="sec-title" style={{margin:0}}>🎯 Answer Options <span className="mut fs-xs" style={{fontWeight:400}}>— click ✓ to mark correct</span></div>
            <button className="btn btn-ghost btn-sm" onClick={addOpt}>+ Add</button>
          </div>
          {form.opts.map((o,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:9,marginBottom:9}}>
              <button onClick={()=>toggleAns(i)} style={{width:34,height:34,borderRadius:'50%',border:`2px solid ${form.ans.includes(i)?'var(--green)':'rgba(255,255,255,.15)'}`,background:form.ans.includes(i)?'var(--green)':'rgba(255,255,255,.08)',color:form.ans.includes(i)?'#fff':'var(--t2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'0.92rem',transition:'.18s'}}>✓</button>
              <span className="badge b-purple" style={{minWidth:26,justifyContent:'center'}}>{LETTERS[i]}</span>
              <input className="inp fl1" value={o} placeholder={`Option ${LETTERS[i]}`} onChange={e=>setOpt(i,e.target.value)}/>
              {i>=2&&<button onClick={()=>removeOpt(i)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:'1.15rem',padding:'4px 6px'}}>✕</button>}
            </div>
          ))}
          {form.ans.length>0&&<p className="grn fs-xs mt1" style={{marginTop:6}}>✅ Correct: {form.ans.map(i=>LETTERS[i]).join(', ')}</p>}
        </div>
        <div className="card mb3" style={{marginBottom:14}}>
          <div className="sec-title">💡 Explanation</div>
          <textarea className="inp" rows={2} placeholder="Why is this the correct answer?" value={form.exp} onChange={e=>setForm(p=>({...p,exp:e.target.value}))}/>
        </div>
        <div className="fl gap2 mb4" style={{marginBottom:20}}>
          <button className="btn btn-primary fl1" onClick={saveQ} disabled={saving}>
            {saving ? '⏳ Saving…' : editBankId ? '💾 Update Question' : '💾 Save & Add to Bank'}
          </button>
          <button className="btn btn-ghost" onClick={clearForm}>🗑️ Clear</button>
        </div>
      </>)}

      {tab==='bank'&&(<>
        <div className="fl fla gap2 mb3 flw" style={{marginBottom:14,flexWrap:'wrap'}}>
          <select className="inp" style={{width:'auto',flex:1,minWidth:130}} value={filter.topic} onChange={e=>setFilter(p=>({...p,topic:e.target.value}))}>
            <option value="All">All Topics</option>
            {topics.map(t=><option key={t} value={t}>{getTopicEmoji(t,topicMeta)} {t}</option>)}
          </select>
          <select className="inp" style={{width:'auto',flex:1,minWidth:110}} value={filter.diff} onChange={e=>setFilter(p=>({...p,diff:e.target.value}))}>
            <option value="all">All Levels</option><option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option>
          </select>
          <span className="mut fs-xs" style={{alignSelf:'center'}}>{filtered.length}/{dbQuestions.length}</span>
        </div>
        {filtered.length===0?<div className="empty card"><p>No questions match</p></div>:filtered.map(q=>(
          <div key={q.id} className="card card-sm" style={{padding:'12px 14px',marginBottom:8}}>
            <div className="fl fla flb mb2" style={{flexWrap:'wrap',rowGap:8}}>
              <div className="fl fla gap2" style={{flexWrap:'wrap',rowGap:6,flex:'1 1 200px',minWidth:0}}>
                <span className="badge b-blue fs-xs">{getTopicEmoji(q.topic,topicMeta)} {q.topic}</span>
                <span className={`badge diff-${q.diff}`}>{q.diff}</span>
                <span className="badge b-yellow fs-xs">+{q.pts}pts</span>
                {q.mediaUrl && <span title="Has media" style={{fontSize:'0.85rem',padding:'2px 6px',borderRadius:6,background:'rgba(123,97,255,.2)',border:'1px solid rgba(123,97,255,.4)',color:'var(--blue2)'}}>🖼️ media</span>}
              </div>
              <div className="fl gap2" style={{flexShrink:0,marginLeft:'auto'}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>editBankQuestion(q)}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={()=>deleteFromBank(q.id)}>🗑️</button>
              </div>
            </div>
            <div className="fw8 fs-sm mb2" style={{marginBottom:8}}>{q.q}</div>
            {q.mediaUrl && <MediaPreview url={q.mediaUrl} type={q.mediaType} />}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:q.mediaUrl?8:0}}>
              {q.opts.map((o,i)=>(
                <div key={i} style={{padding:'4px 8px',borderRadius:7,fontSize:'0.85rem',fontWeight:700,background:q.ans.includes(i)?'rgba(76,175,80,.12)':'rgba(255,255,255,.04)',border:`1px solid ${q.ans.includes(i)?'rgba(76,175,80,.4)':'rgba(255,255,255,.07)'}`,display:'flex',alignItems:'center',gap:5}}>
                  <span style={{color:q.ans.includes(i)?'var(--green)':'var(--t2)',fontWeight:900,fontSize:'0.8rem'}}>{LETTERS[i]}</span>{o}
                  {q.ans.includes(i)&&<span style={{marginLeft:'auto'}}>✅</span>}
                </div>
              ))}
            </div>
            {q.exp&&<p className="mut fs-xs mt1" style={{marginTop:5}}>💡 {q.exp}</p>}
          </div>
        ))}
      </>)}
    </div>
  );
}

// ─── TOPICS ──────────────────────────────────────────────────────────────────
function Topics({ topicMeta, dbQuestions, setDbQuestions, toast }) {
  const { dispatch } = useApp();
  const [showAdd,  setShowAdd]  = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form,     setForm]     = useState({ name:'', emoji:'📚', color:'#4F8CFF' });

  // Build live stats from current topicMeta (includes custom topics)
  const topicsWithData = Object.entries(topicMeta).map(([name,meta])=>({
    name, ...meta,
    questions: dbQuestions.filter(q=>q.topic===name),
    easy:   dbQuestions.filter(q=>q.topic===name&&q.diff==='easy').length,
    medium: dbQuestions.filter(q=>q.topic===name&&q.diff==='medium').length,
    hard:   dbQuestions.filter(q=>q.topic===name&&q.diff==='hard').length,
    eligible: dbQuestions.filter(q=>q.topic===name).length>=3,
  }));

  const addTopic = async () => {
    if (!form.name.trim())                { toast('Enter a topic name!','error'); return; }
    if (topicMeta[form.name.trim()])      { toast('Topic already exists!','error'); return; }
    dispatch({ type:'ADD_TOPIC', name:form.name.trim(), emoji:form.emoji, color:form.color });
    // Persist to the backend so the topic survives a restart (best-effort).
    try { await api.addTopic({ name:form.name.trim(), emoji:form.emoji, color:form.color }); } catch(_){}
    toast(`Topic "${form.name}" added! 🎉`,'success');
    setShowAdd(false); setForm({ name:'', emoji:'📚', color:'#4F8CFF' });
  };

  const removeTopic = async (name) => {
    const qs = dbQuestions.filter(q=>q.topic===name);
    for (const q of qs) { try { await api.deleteQuestion(q.id); } catch(_){} }
    setDbQuestions(prev=>prev.filter(q=>q.topic!==name));
    dispatch({ type:'REMOVE_TOPIC', name });
    if (expanded===name) setExpanded(null);
    toast(`"${name}" and ${qs.length} questions removed`,'info');
  };

  const deleteQuestion = async (qId) => {
    setDeleting(qId);
    try { await api.deleteQuestion(qId); setDbQuestions(prev=>prev.filter(q=>q.id!==qId)); toast('Question deleted','success'); }
    catch(err){ toast(err.message,'error'); }
    setDeleting(null);
  };

  return (
    <div>
      <div className="fl fla flb mb3">
        <h2 style={{fontSize:'1.5rem'}}>📂 Topics & Questions</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add Topic</button>
      </div>
      <div style={{padding:'10px 16px',borderRadius:12,background:'rgba(79,140,255,.08)',border:'1px solid rgba(79,140,255,.2)',marginBottom:16,fontSize:'0.92rem',color:'var(--blue)'}}>
        ℹ️ Topics need at least <strong>3 questions</strong> to appear in a game. Click a topic to expand and manage individual questions.
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {topicsWithData.map(t=>(
          <div key={t.name} style={{background:`linear-gradient(135deg,${t.color}18,${t.color}08)`,borderRadius:16,border:`1.5px solid ${t.eligible?t.color+'55':'rgba(255,255,255,.08)'}`,overflow:'hidden'}}>
            <div className="fl fla gap3 flw" style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpanded(expanded===t.name?null:t.name)}>
              <span style={{fontSize:'1.6rem',flexShrink:0}}>{t.emoji}</span>
              <div style={{flex:'1 1 160px',minWidth:0}}>
                <div className="fl fla gap2 flw">
                  <span className="fw8" style={{color:t.eligible?t.color:'var(--t2)'}}>{t.name}</span>
                  <div className="fl fla gap1">
                    <span style={{padding:'2px 6px',borderRadius:8,background:'rgba(76,175,80,.15)',color:'var(--green)',fontSize:'0.78rem',fontWeight:700}}>🟢{t.easy}</span>
                    <span style={{padding:'2px 6px',borderRadius:8,background:'rgba(255,217,61,.15)',color:'var(--yellow)',fontSize:'0.78rem',fontWeight:700}}>🟡{t.medium}</span>
                    <span style={{padding:'2px 6px',borderRadius:8,background:'rgba(255,82,82,.15)',color:'var(--red)',fontSize:'0.78rem',fontWeight:700}}>🔴{t.hard}</span>
                  </div>
                  <span className={`badge ${t.eligible?'b-green':'b-red'}`} style={{fontSize:'0.75rem'}}>{t.eligible?`✅ ${t.questions.length} questions`:`⚠️ ${t.questions.length}/3 needed`}</span>
                </div>
              </div>
              <div className="fl fla gap2" style={{flexShrink:0,marginLeft:'auto'}}>
                <span className="mut fs-xs">{expanded===t.name?'▲ Hide':'▼ Manage'}</span>
                <button className="btn btn-danger btn-sm" onClick={e=>{e.stopPropagation();removeTopic(t.name);}} style={{fontSize:'0.85rem',padding:'5px 10px',whiteSpace:'nowrap'}}>🗑️ Remove Topic</button>
              </div>
            </div>
            {expanded===t.name&&(
              <div style={{borderTop:`1px solid ${t.color}33`,padding:'12px 16px',background:'rgba(0,0,0,.2)'}}>
                {t.questions.length===0?<p className="mut fs-sm" style={{padding:8}}>No questions yet. Add via Quiz Builder →</p>:(
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {t.questions.map((q,i)=>(
                      <div key={q.id} style={{background:'rgba(255,255,255,.04)',borderRadius:12,padding:'10px 14px',border:'1px solid rgba(255,255,255,.07)',opacity:deleting===q.id?.4:1,transition:'opacity .2s'}}>
                        <div className="fl fla flb mb2" style={{marginBottom:6}}>
                          <div className="fl fla gap2">
                            <span className="mut fs-xs fw8">#{i+1}</span>
                            <span className={`badge diff-${q.diff}`} style={{fontSize:'0.75rem'}}>{q.diff}</span>
                            <span className="badge b-yellow fs-xs">+{q.pts}pts</span>
                          </div>
                          <button className="btn btn-danger btn-sm" onClick={()=>deleteQuestion(q.id)} disabled={deleting===q.id} style={{fontSize:'0.82rem',padding:'4px 8px'}}>{deleting===q.id?'⏳':'🗑️ Delete'}</button>
                        </div>
                        <div className="fw8 fs-sm mb1" style={{marginBottom:5}}>{q.q}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                          {q.opts.map((o,oi)=>(
                            <div key={oi} style={{padding:'3px 8px',borderRadius:6,fontSize:'0.82rem',fontWeight:700,display:'flex',alignItems:'center',gap:4,background:q.ans.includes(oi)?'rgba(76,175,80,.12)':'rgba(255,255,255,.04)',border:`1px solid ${q.ans.includes(oi)?'rgba(76,175,80,.3)':'rgba(255,255,255,.07)'}`}}>
                              <span style={{color:q.ans.includes(oi)?'var(--green)':'var(--t3)',fontWeight:900,fontSize:'0.75rem',minWidth:12}}>{['A','B','C','D'][oi]}</span>{o}
                              {q.ans.includes(oi)&&<span style={{marginLeft:'auto'}}>✅</span>}
                            </div>
                          ))}
                        </div>
                        {q.exp&&<p className="mut fs-xs mt1" style={{marginTop:4}}>💡 {q.exp}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Modal show={showAdd} onClose={()=>setShowAdd(false)}>
        <h3 style={{fontSize:'1.18rem',marginBottom:16}}>➕ Add New Topic</h3>
        <div className="fg"><label className="lbl">Topic Name</label><input className="inp" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Physics"/></div>
        <div className="fg"><label className="lbl">Emoji Icon</label><input className="inp" value={form.emoji} onChange={e=>setForm(p=>({...p,emoji:e.target.value}))} maxLength={2}/></div>
        <div className="fg"><label className="lbl">Color</label><input className="inp" type="color" value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))} style={{height:44}}/></div>
        <div className="fl gap2 mt3" style={{marginTop:14}}>
          <button className="btn btn-primary fl1" onClick={addTopic}>Add Topic</button>
          <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── SHARED SCREEN MONITOR ───────────────────────────────────────────────────
// Mentor view for the Shared Screen mode — overview + tips + quick setup
function SharedScreenMonitor({ dbQuestions, topicMeta }) {
  const available = Object.entries(topicMeta).filter(([name]) =>
    dbQuestions.filter(q=>q.topic===name).length >= 3
  );
  const totalQ = dbQuestions.length;

  return (
    <div style={{maxWidth:800}}>
      <h2 style={{fontSize:'1.5rem',marginBottom:6}}>🖥️ Shared Screen Mode</h2>
      <p className="mut fs-sm mb3" style={{marginBottom:18}}>
        Run QuizQuest on a single projector or screen. All teams take turns on the same device — no phones needed!
      </p>

      {/* Quick start button */}
      <div style={{background:'linear-gradient(135deg,rgba(79,140,255,.15),rgba(123,97,255,.15))',border:'2px solid rgba(123,97,255,.35)',borderRadius:20,padding:'24px 22px',marginBottom:20,textAlign:'center'}}>
        <div style={{fontSize:'3rem',marginBottom:10}}>🖥️</div>
        <h3 style={{fontSize:'1.3rem',marginBottom:8}}>Launch Shared Screen Game</h3>
        <p className="mut fs-sm" style={{marginBottom:16}}>Opens the team game on this device. Students gather around and take turns.</p>
        <button className="btn btn-primary btn-lg"
          onClick={()=>window.open(`${window.location.origin}/?screen=shared`,'_blank')}>
          🚀 Open Student Screen
        </button>
        <p className="mut fs-xs mt2" style={{marginTop:8}}>Opens Shared Screen mode directly in a new tab</p>
      </div>

      {/* Two-column info */}
      <div className="grid2" style={{gap:14,marginBottom:14}}>
        {/* How it works */}
        <div className="card">
          <div className="sec-title">📋 How It Works</div>
          {[
            ['1️⃣','Click "Open Student Screen"','Opens Shared Screen mode directly in a new tab'],
            ['2️⃣','Set teams & questions','2–4 teams, 3–10 questions each'],
            ['3️⃣','Teams take turns','Pick topic → answer → see score'],
            ['4️⃣','Final leaderboard','Shows after all rounds done'],
          ].map(([num,title,desc])=>(
            <div key={num} className="fl fla gap3" style={{padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
              <span style={{fontSize:'1.2rem'}}>{num}</span>
              <div><div className="fw8 fs-sm">{title}</div><div className="mut fs-xs">{desc}</div></div>
            </div>
          ))}
        </div>

        {/* Current question bank status */}
        <div className="card">
          <div className="sec-title">📚 Question Bank Status</div>
          <div className="fl fla gap2 mb3" style={{marginBottom:14}}>
            <div style={{flex:1,textAlign:'center',padding:'12px',borderRadius:12,background:'rgba(79,140,255,.1)',border:'1px solid rgba(79,140,255,.2)'}}>
              <div style={{fontSize:'1.6rem',fontWeight:900,color:'var(--blue)'}}>{totalQ}</div>
              <div className="mut fs-xs">Total Questions</div>
            </div>
            <div style={{flex:1,textAlign:'center',padding:'12px',borderRadius:12,background:'rgba(76,175,80,.1)',border:'1px solid rgba(76,175,80,.2)'}}>
              <div style={{fontSize:'1.6rem',fontWeight:900,color:'var(--green)'}}>{available.length}</div>
              <div className="mut fs-xs">Eligible Topics</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {Object.entries(topicMeta).map(([name,meta])=>{
              const cnt=dbQuestions.filter(q=>q.topic===name).length;
              const ok=cnt>=3;
              return(
                <div key={name} className="fl fla gap2" style={{padding:'5px 10px',borderRadius:10,background:ok?`${meta.color}15`:'rgba(255,255,255,.03)',border:`1px solid ${ok?meta.color+'44':'rgba(255,255,255,.06)'}`}}>
                  <span>{meta.emoji}</span>
                  <span className="fw8 fs-xs fl1" style={{color:ok?meta.color:'var(--t3)'}}>{name}</span>
                  <span className={`badge ${ok?'b-green':'b-red'}`} style={{fontSize:'0.75rem'}}>{ok?`✅ ${cnt}q`:`⚠️ ${cnt}/3`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scoring reminder */}
      <div className="card mb3" style={{marginBottom:14}}>
        <div className="sec-title">💰 Points System (Same for All Modes)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10}}>
          {[['easy','🟢',100,50],['medium','🟡',150,75],['hard','🔴',200,100]].map(([d,ic,c,w])=>(
            <div key={d} style={{padding:'10px 12px',borderRadius:12,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',textAlign:'center'}}>
              <div className="fw8 fs-sm mb1" style={{marginBottom:6}}>{ic} {d[0].toUpperCase()+d.slice(1)}</div>
              <div className="fs-sm grn fw8">✅ Correct: +{c}</div>
              <div className="fs-sm rdc fw8">❌ Wrong: −{w}</div>
              <div className="fs-xs mut mt1" style={{marginTop:4}}>⏰ Timeout: −{w}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="card">
        <div className="sec-title">💡 Tips for Classroom Use</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[
            ['🖥️','Use a projector or large TV','All students can see the question clearly'],
            ['👥','2–4 teams work best','Bigger classes → split into groups first'],
            ['⏱️','Set 20–30s timer','Enough time to discuss as a team'],
            ['🎯','3–5 questions per team','Good for a 20–30 min class activity'],
            ['📝','Read questions aloud','Helps everyone stay engaged even when watching'],
            ['🔥','Enable "Shared Screen" from home page','Not from the mentor dashboard directly'],
          ].map(([ic,title,tip])=>(
            <div key={title} className="fl fla gap3" style={{padding:'8px 10px',borderRadius:10,background:'rgba(255,255,255,.03)'}}>
              <span style={{fontSize:'1.2rem',minWidth:28}}>{ic}</span>
              <div><div className="fw8 fs-sm">{title}</div><div className="mut fs-xs">{tip}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
function Results({ sessions, onDeleteSession, onRefresh }) {
  const finished = sessions.filter(s => s.status === 'finished');

  // Load shared screen results from localStorage. This data is written by a
  // SEPARATE tab (the Shared Screen game itself, opened via "Open Student
  // Screen") — localStorage is shared across tabs on the same origin, but
  // React state here is not automatically kept in sync with it. Without the
  // two effects below, "Clear"/"Delete" could look like they didn't work: the
  // click itself always did clear localStorage correctly, but if a shared-
  // screen tab that was mid-game (or got replayed) wrote a fresh result
  // around the same time, or the mentor just hadn't reloaded since a new
  // game finished elsewhere, the list could show stale/reappearing data with
  // no obvious cause.
  const loadSharedResults = () => {
    try { return JSON.parse(localStorage.getItem('quizquest_shared_results') || '[]'); } catch(_) { return []; }
  };
  const [sharedResults, setSharedResults] = React.useState(loadSharedResults);

  // Live cross-tab sync: the 'storage' event fires in THIS tab whenever
  // localStorage is changed by ANOTHER tab (e.g. a Shared Screen game
  // finishing on the student device) — so a freshly-finished game appears
  // here without needing a manual refresh, and if that other tab is the
  // reason "the same result kept showing", it now shows up as a real new
  // entry rather than looking like the Clear button silently failed.
  React.useEffect(() => {
    const onStorage = (e) => { if (!e.key || e.key === 'quizquest_shared_results') setSharedResults(loadSharedResults()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const clearShared = () => {
    localStorage.removeItem('quizquest_shared_results');
    setSharedResults([]);
  };

  const hasAny = finished.length > 0 || sharedResults.length > 0;

  return (
    <div>
      <div className="fl fla flb mb3">
        <h2 style={{fontSize:'1.5rem'}}>📈 Results</h2>
        <div className="fl gap2">
          {onRefresh && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{ onRefresh(); setSharedResults(loadSharedResults()); }} title="Refresh results">🔄 Refresh</button>
          )}
          {sharedResults.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={clearShared}>🗑️ Clear Shared Results</button>
          )}
        </div>
      </div>

      {!hasAny && (
        <div className="empty card">
          <div style={{fontSize:'2.5rem',marginBottom:10}}>📊</div>
          <p className="fw8 mb2">No results yet</p>
          <p className="fs-sm mut">Results appear here after games finish</p>
        </div>
      )}

      {/* Multi-device session results — split into Solo and Team */}
      {finished.length > 0 && (
        <div className="mb4" style={{marginBottom:20}}>
          {/* Solo Sessions */}
          {finished.filter(s => s.mode === 'individual').length > 0 && (
            <>
              <div className="sec-title">🏅 Solo Sessions</div>
              {finished.filter(s => s.mode === 'individual').map(s => {
                const players = (s.individualPlayers || []);
                const topPlayer = players[0];
                return (
                  <div key={s.code} className="card mb3" style={{marginBottom:12}}>
                    <div className="fl fla flb mb2">
                      <div>
                        <div className="fw8 fs-lg">{s.title}</div>
                        <div className="fl fla gap2 mt1" style={{marginTop:5}}>
                          <span className="badge b-purple" style={{fontFamily:'Fredoka,cursive',letterSpacing:2}}>{s.code}</span>
                          <span className="badge b-green">Finished</span>
                          <span className="badge b-purple">{s.questionCount} questions</span>
                          <span className="badge" style={{background:'rgba(76,175,80,.2)',color:'var(--green)',border:'1px solid rgba(76,175,80,.4)'}}>🏅 Solo</span>
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" title="Delete this result"
                        onClick={()=>{ if(window.confirm('Delete this session result?')) { onDeleteSession(s.code); } }}>
                        🗑️ Delete
                      </button>
                    </div>
                    {players.length > 0 ? (
                      <>
                        {topPlayer && (
                          <div style={{padding:'8px 14px',borderRadius:10,background:'rgba(255,217,61,.1)',border:'1px solid rgba(255,217,61,.35)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:'1.2rem'}}>🥇</span>
                            <span className="fw8 fs-sm" style={{color:'var(--yellow)'}}>{topPlayer.name}</span>
                            <span style={{marginLeft:'auto',fontWeight:900,color:'var(--yellow)'}}>{topPlayer.score} pts</span>
                          </div>
                        )}
                        <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.92rem'}}>
                            <thead>
                              <tr style={{borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.85rem'}}>#</th>
                                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.85rem'}}>Player Name</th>
                                <th style={{textAlign:'right',padding:'6px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.85rem'}}>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {players.map((p, i) => (
                                <tr key={p.name||i} style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                                  <td style={{padding:'7px 8px',color:'var(--t3)',fontWeight:700}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                                  <td style={{padding:'7px 8px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                                      <span>{p.avatar||'🦁'}</span>
                                      <span className="fw8">{p.name}</span>
                                    </div>
                                  </td>
                                  <td style={{padding:'7px 8px',textAlign:'right',fontWeight:900,color:'var(--blue)'}}>{p.score} pts</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="mut fs-sm">No player data recorded.</p>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Team Sessions */}
          {finished.filter(s => s.mode !== 'individual').length > 0 && (
            <>
              <div className="sec-title">🌐 Team Sessions</div>
              {finished.filter(s => s.mode !== 'individual').map(s => {
                const sortedTeams = [...s.teams].sort((a,b)=>b.score-a.score);
                const winner = sortedTeams[0];
                const history = s.roundHistory || [];
                return (
                  <div key={s.code} className="card mb3" style={{marginBottom:12}}>
                    <div className="fl fla flb mb2">
                      <div>
                        <div className="fw8 fs-lg">{s.title}</div>
                        <div className="fl fla gap2 mt1" style={{marginTop:5,flexWrap:'wrap'}}>
                          <span className="badge b-purple" style={{fontFamily:'Fredoka,cursive',letterSpacing:2}}>{s.code}</span>
                          <span className="badge b-green">Finished</span>
                          <span className="badge b-purple">{s.questionCount} questions</span>
                          {s.finishedAt && <span className="mut fs-xs">{new Date(s.finishedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" title="Delete this result"
                        onClick={()=>{ if(window.confirm('Delete this session result?')) { onDeleteSession(s.code); } }}>
                        🗑️ Delete
                      </button>
                    </div>

                    {/* Winner banner */}
                    {winner && (
                      <div style={{padding:'10px 14px',borderRadius:10,background:`${winner.color}18`,border:`2px solid ${winner.color}55`,marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:'1.5rem'}}>🏆</span>
                        <div style={{flex:1}}>
                          <div className="fw8 fs-sm" style={{color:winner.color}}>{winner.emoji} {winner.name} wins!</div>
                          <div className="mut fs-xs" style={{marginTop:2}}>{winner.score} points</div>
                        </div>
                      </div>
                    )}

                    {/* All team scores */}
                    <div className="fl flw gap2 mb3" style={{marginBottom:12}}>
                      {sortedTeams.map((t,i)=>(
                        <div key={t.id} style={{padding:'10px 14px',borderRadius:12,background:`${t.color}18`,border:`1.5px solid ${t.color}55`,minWidth:120,flex:1}}>
                          <div className="fs-xs mut">#{i+1} {i===0?'🥇':i===1?'🥈':'🥉'}</div>
                          <div className="fw8 fs-sm" style={{color:t.color,marginTop:2}}>{t.emoji} {t.name}</div>
                          <div style={{fontSize:'1.3rem',fontWeight:900,color:t.color,marginTop:4}}>{t.score} pts</div>
                          <div className="mut fs-xs">{t.playerCount} player{t.playerCount!==1?'s':''}</div>
                        </div>
                      ))}
                    </div>

                    {/* Round history table — becomes a stacked card list on narrow screens (see .responsive-table CSS) */}
                    {history.length > 0 && (
                      <div style={{overflowX:'auto'}}>
                        <table className="responsive-table" style={{width:'100%',borderCollapse:'collapse',fontSize:'0.9rem'}}>
                          <thead>
                            <tr style={{borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                              <th style={{textAlign:'left',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>#</th>
                              <th style={{textAlign:'left',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Team</th>
                              <th style={{textAlign:'left',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Topic</th>
                              <th style={{textAlign:'left',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Difficulty</th>
                              <th style={{textAlign:'left',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Result</th>
                              <th style={{textAlign:'right',padding:'5px 8px',color:'var(--t3)',fontWeight:700,fontSize:'0.82rem'}}>Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((r,i)=>{
                              const td = s.teams.find(t=>t.id===r.teamId);
                              return (
                                <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.05)',background:r.correct?'rgba(76,175,80,.03)':r.timedOut?'rgba(255,217,61,.03)':'rgba(255,82,82,.03)'}}>
                                  <td data-label="#" style={{padding:'6px 8px',color:'var(--t3)',fontWeight:700}}>#{i+1}</td>
                                  <td data-label="Team" style={{padding:'6px 8px'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                                      <span style={{fontSize:'0.95rem'}}>{td?.emoji||'👥'}</span>
                                      <span className="fw8" style={{color:td?.color||'var(--t1)'}}>{r.teamName}</span>
                                    </div>
                                  </td>
                                  <td data-label="Topic" style={{padding:'6px 8px',color:'var(--t2)'}}>{r.topic||'—'}</td>
                                  <td data-label="Difficulty" style={{padding:'6px 8px'}}>
                                    <span className={`badge diff-${r.diff}`} style={{fontSize:'0.75rem'}}>{r.diff||'—'}</span>
                                  </td>
                                  <td data-label="Result" style={{padding:'6px 8px'}}>
                                    <span style={{fontWeight:700,color:r.correct?'var(--green)':r.timedOut?'var(--yellow)':'var(--red)'}}>
                                      {r.skipped?'⏭ Skipped':r.timedOut?'⏰ Timeout':r.correct?'✅ Correct':'❌ Wrong'}
                                    </span>
                                  </td>
                                  <td data-label="Points" style={{padding:'6px 8px',textAlign:'right',fontWeight:900,color:r.totalChange>0?'var(--green)':r.totalChange<0?'var(--red)':'var(--t3)'}}>
                                    {r.totalChange>0?'+':''}{r.totalChange||0}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Shared screen results */}
      {sharedResults.length > 0 && (
        <div>
          <div className="sec-title">🖥️ Shared Screen Games</div>
          {sharedResults.map((r, idx) => (
            <div key={idx} className="card mb3" style={{marginBottom:12}}>
              <div className="fl fla flb flw gap2 mb2">
                <div style={{minWidth:0,flex:'1 1 200px'}}>
                  <div className="fw8 fs-lg">{r.title || `Shared Game #${idx+1}`}</div>
                  <div className="fl fla gap2 flw mt1" style={{marginTop:5}}>
                    <span className="badge b-blue">🖥️ Shared Screen</span>
                    <span className="badge b-green">Finished</span>
                    <span className="badge b-purple">{r.rounds?.length || 0} rounds played</span>
                    <span className="mut fs-xs">{r.date ? new Date(r.date).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" title="Delete this result" style={{flexShrink:0,whiteSpace:'nowrap'}}
                  onClick={()=>{ if(window.confirm('Delete this result?')){ const updated=sharedResults.filter((_,i)=>i!==idx); setSharedResults(updated); localStorage.setItem('quizquest_shared_results',JSON.stringify(updated)); } }}>
                  🗑️ Delete
                </button>
              </div>

              {/* Team final scores */}
              <div className="fl flw gap2 mb3" style={{marginBottom:12}}>
                {[...r.teams].sort((a,b)=>b.score-a.score).map((t,i)=>(
                  <div key={t.id} style={{padding:'10px 14px',borderRadius:12,background:`${t.color}18`,border:`1.5px solid ${t.color}55`,minWidth:120}}>
                    <div className="fs-xs mut">#{i+1} {i===0?'🥇':i===1?'🥈':'🥉'}</div>
                    <div className="fw8 fs-sm" style={{color:t.color}}>{t.emoji} {t.name}</div>
                    <div style={{fontSize:'1.2rem',fontWeight:900,color:t.color}}>{t.score} pts</div>
                    <div className="mut fs-xs">
                      ✅ {r.rounds?.filter(rnd=>rnd.teamId===t.id&&rnd.correct).length||0} correct &nbsp;
                      ❌ {r.rounds?.filter(rnd=>rnd.teamId===t.id&&!rnd.correct).length||0} wrong
                    </div>
                  </div>
                ))}
              </div>

              {/* Round history table — becomes a stacked card list on narrow screens (see .responsive-table CSS) */}
              {r.rounds?.length > 0 && (
                <div style={{overflowX:'auto'}}>
                  <table className="responsive-table" style={{fontSize:'0.88rem'}}>
                    <thead>
                      <tr>
                        <th>#</th><th>Team</th><th>Topic</th><th>Difficulty</th><th>Result</th><th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.rounds.map((rnd, ri) => {
                        const team = r.teams.find(t=>t.id===rnd.teamId);
                        return (
                          <tr key={ri}>
                            <td data-label="#" className="mut">{ri+1}</td>
                            <td data-label="Team"><span style={{color:team?.color,fontWeight:700}}>{team?.emoji} {rnd.teamName}</span></td>
                            <td data-label="Topic">{rnd.topic}</td>
                            <td data-label="Difficulty"><span className={`badge diff-${rnd.diff}`} style={{fontSize:'0.75rem'}}>{rnd.diff}</span></td>
                            <td data-label="Result">{rnd.correct?'✅ Correct':rnd.timedOut?'⏰ Timeout':'❌ Wrong'}</td>
                            <td data-label="Points" style={{color:rnd.totalChange>0?'var(--green)':'var(--red)',fontWeight:800}}>
                              {rnd.totalChange>0?'+':''}{rnd.totalChange}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
