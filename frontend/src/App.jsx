import React, { useEffect, useState } from 'react';
import './styles/globals.css';
import { AppProvider, useApp } from './context/AppContext';
import { useSocketSetup } from './hooks/useSocket';
import { BgOrbs, ToastContainer, ErrorBanner } from './components/shared';

import { Landing, MentorGate }    from './screens/Landing';
import { MentorLogin }             from './screens/MentorLogin';
import { MentorDash }              from './screens/MentorDash';
import { StudentJoin, IndividualJoin } from './screens/StudentJoin';
import { Practice }                   from './screens/Practice';
import {
  Lobby, TopicPickScreen, GameScreen,
  RoundResult, FinalLeaderboard, SharedGameScreen,
} from './screens/GameScreens';

const MENTOR_SECRET_PATH = '/mentor';
const VALID_PATHS = ['/', MENTOR_SECRET_PATH];

function NotFound({ path }) {
  const { go } = useApp();
  return (
    <div className="screen" style={{ alignItems:'center', justifyContent:'center', textAlign:'center', padding:40 }}>
      <div style={{ fontSize:'5rem', marginBottom:16 }}>🔍</div>
      <h2 style={{ fontSize:'1.8rem', marginBottom:8 }}>Page Not Found</h2>
      <p className="mut fs-sm" style={{ marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        <code style={{ background:'rgba(255,255,255,.08)', padding:'2px 8px', borderRadius:6, fontSize:'0.92rem' }}>
          {path}
        </code>
        {' '}doesn't exist.
      </p>
      <button className="btn btn-primary" onClick={() => { window.history.pushState({}, '', '/'); go('landing'); }}>
        ← Go Home
      </button>
    </div>
  );
}

function Router() {
  const { state, go } = useApp();
  useSocketSetup();

  const { screen, error } = state;
  const isMentor = !!state.mentor;
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleURL = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      setCurrentPath(window.location.pathname);
      if (path === MENTOR_SECRET_PATH.toLowerCase() && state.screen === 'landing') {
        go('mentor-gate');
      }
      // Lets "Open Student Screen" in the mentor panel deep-link straight into
      // Shared Screen mode instead of landing on the home page and requiring
      // an extra manual click on the "Shared Screen" card.
      const params = new URLSearchParams(window.location.search);
      if (params.get('screen') === 'shared' && path === '/' && state.screen === 'landing') {
        go('shared-game');
      }
    };
    handleURL();
    window.addEventListener('popstate', handleURL);
    return () => window.removeEventListener('popstate', handleURL);
  }, []); // eslint-disable-line

  const normalizedPath = currentPath.toLowerCase().replace(/\/$/, '') || '/';
  const isValidPath = VALID_PATHS.some(p => p.toLowerCase() === normalizedPath);

  if (!isValidPath) {
    return (
      <>
        <BgOrbs />
        <NotFound path={currentPath} />
      </>
    );
  }

  // Game screens that belong exclusively to the mentor panel during a live session
  const MENTOR_GAME_SCREENS = ['topic-pick', 'game', 'round-result', 'lobby', 'final-leaderboard'];

  return (
    <>
      <BgOrbs />
      <ToastContainer />
      {error && <ErrorBanner msg={error} onRetry={() => window.location.reload()} />}

      {/* ── MENTOR VIEWS ── always render MentorDash when logged in as mentor */}
      {isMentor && (screen === 'mentor-dash' || MENTOR_GAME_SCREENS.includes(screen)) && <MentorDash />}
      {!isMentor && screen === 'mentor-gate'  && <MentorGate />}
      {!isMentor && screen === 'mentor-login' && <MentorLogin />}

      {/* ── PUBLIC / STUDENT VIEWS ── only show when NOT a mentor */}
      {screen === 'landing'         && !isMentor && <Landing />}
      {screen === 'student-join'    && !isMentor && <StudentJoin />}
      {screen === 'individual-join' && !isMentor && <IndividualJoin />}
      {screen === 'practice'        && !isMentor && <Practice />}
      {screen === 'lobby'           && !isMentor && <Lobby />}
      {screen === 'topic-pick'      && !isMentor && <TopicPickScreen />}
      {screen === 'game'            && !isMentor && <GameScreen />}
      {screen === 'round-result'    && !isMentor && <RoundResult />}
      {screen === 'final-leaderboard' && !isMentor && <FinalLeaderboard />}

      {/* ── SHARED SCREENS ── available to both roles */}
      {screen === 'shared-game'     && <SharedGameScreen />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
