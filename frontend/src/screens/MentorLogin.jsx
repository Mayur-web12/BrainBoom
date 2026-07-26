import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { connectSocket } from '../utils/socket';
import { useEmit } from '../hooks/useSocket';

export function MentorLogin() {
  const { go, toast, dispatch } = useApp();
  const emit = useEmit();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});
  const [showPass, setShowPass] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.trim())                                       e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password.trim())                                    e.password = 'Password is required';
    else if (password.length < 4)                            e.password = 'Password must be at least 4 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const login = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const data = await api.login(email.trim(), password.trim());
      dispatch({ type:'SET_MENTOR', mentor: data.mentor });
      connectSocket();
      await emit('mentor-auth', { email: email.trim(), password: password.trim() });
      toast(`Welcome, ${data.mentor.name}! 🎓`, 'success');
      go('mentor-dash');
    } catch (err) {
      setErrors({ form: err.message || 'Invalid email or password. Please try again.' });
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') login(); };

  return (
    <div className="screen" style={{ background:'var(--bg)', alignItems:'center', justifyContent:'center', padding:20 }}>

      {/* Minimal nav — NO back button on secret mentor page */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, padding:'12px 20px', display:'flex', alignItems:'center', zIndex:100 }}>
        {/* Unique BrainBoom mentor logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7B61FF,#4F8CFF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.15rem', boxShadow:'0 4px 12px rgba(123,97,255,.4)' }}>🎓</div>
          <span style={{ fontFamily:'Fredoka,cursive', fontSize:'1.3rem', background:'linear-gradient(135deg,#4F8CFF,#7B61FF)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontWeight:700 }}>BrainBoom</span>
          <span style={{ fontSize:'0.75rem', padding:'2px 8px', borderRadius:20, background:'rgba(123,97,255,.2)', border:'1px solid rgba(123,97,255,.4)', color:'var(--blue2)', fontWeight:800, letterSpacing:1 }}>ADMIN</span>
        </div>
        {/* No right-side content — security: don't indicate this is a special page */}
      </nav>

      <div style={{ maxWidth:420, width:'100%', marginTop:60 }}>

        {/* Icon + title */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{
            width:80, height:80, borderRadius:24, margin:'0 auto 18px',
            background:'linear-gradient(135deg,#7B61FF,#4F8CFF)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'2.4rem', boxShadow:'0 12px 40px rgba(123,97,255,.45)',
            border:'2px solid rgba(255,255,255,.12)',
          }}>🎓</div>
          <h1 style={{ fontSize:'1.9rem', marginBottom:5 }}>Mentor Login</h1>
          <p className="mut fs-sm">Access your quiz control panel</p>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding:'28px 24px', border:'1px solid rgba(123,97,255,.25)', boxShadow:'0 0 40px rgba(123,97,255,.1)' }}>

          {/* Form error */}
          {errors.form && (
            <div style={{ padding:'11px 14px', borderRadius:10, background:'rgba(255,82,82,.1)', border:'1px solid rgba(255,82,82,.4)', marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
              <span>⚠️</span><span className="rdc fw8 fs-sm">{errors.form}</span>
            </div>
          )}

          {/* Email */}
          <div className="fg">
            <label className="lbl">Email Address</label>
            <input
              className="inp"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p=>({...p,email:'',form:''})); }}
              onKeyDown={handleKey}
              placeholder="Enter your email"
              autoComplete="off"
              autoFocus
              style={{ borderColor: errors.email ? 'rgba(255,82,82,.6)' : '' }}
            />
            {errors.email && <p className="rdc fs-xs mt1" style={{ marginTop:5 }}>⚠️ {errors.email}</p>}
          </div>

          {/* Password */}
          <div className="fg">
            <label className="lbl">Password</label>
            <div style={{ position:'relative' }}>
              <input
                className="inp"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p=>({...p,password:'',form:''})); }}
                onKeyDown={handleKey}
                placeholder="Enter your password"
                autoComplete="off"
                style={{ borderColor: errors.password ? 'rgba(255,82,82,.6)' : '', paddingRight:44 }}
              />
              <button onClick={() => setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--t2)', fontSize:'1.05rem', padding:'4px' }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <p className="rdc fs-xs mt1" style={{ marginTop:5 }}>⚠️ {errors.password}</p>}
          </div>

          {/* Submit */}
          <button className="btn btn-yellow btn-block btn-lg" style={{ marginTop:20 }} onClick={login} disabled={loading}>
            {loading
              ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><span style={{ width:18, height:18, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#000', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' }}/> Signing in…</span>
              : '🚀 Login to Dashboard'
            }
          </button>
        </div>

      </div>
    </div>
  );
}
