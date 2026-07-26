import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

// Default topics
export const DEFAULT_TOPIC_META = {
  Math:      { emoji:'📐', color:'#4F8CFF' },
  Science:   { emoji:'🔬', color:'#7B61FF' },
  History:   { emoji:'🏛️',  color:'#FF8C42' },
  Geography: { emoji:'🌍', color:'#00D4AA' },
  Computer:  { emoji:'💻', color:'#FFD93D' },
  English:   { emoji:'📖', color:'#FF6B9D' },
  General:   { emoji:'🌟', color:'#FF5252' },
  Sabha:     { emoji:'🙏', color:'#F59E0B' },
};

// ── PERSISTENCE ──────────────────────────────────────────────────────────────
// Load saved topicMeta from localStorage (survives page refresh)
function loadTopicMeta() {
  try {
    const saved = localStorage.getItem('quizquest_topics');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults so new default topics always appear
      return { ...DEFAULT_TOPIC_META, ...parsed };
    }
  } catch (_) {}
  return { ...DEFAULT_TOPIC_META };
}

function saveTopicMeta(meta) {
  try { localStorage.setItem('quizquest_topics', JSON.stringify(meta)); } catch (_) {}
}

const INITIAL = {
  screen:           'landing',
  mentor:           null,
  player:           null,
  gameState:        null,
  roundResult:      null,
  leaderboard:      null,
  gameMode:         'team',       // 'team' | 'individual'
  individualPlayers:  [],         // [{name, avatar, score, socketId}]
  individualAnswers:  {},         // {socketId: {correct, totalChange, ...}}
  connected:        false,
  error:            null,
  toasts:           [],
  topicMeta:        loadTopicMeta(),
  gameFinishedAt:   null,         // timestamp set when game-over fires — lets MentorDash auto-reload sessions
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SCREEN':      return { ...state, screen: action.screen, error: null };
    case 'SET_MENTOR':      return { ...state, mentor: action.mentor };
    case 'SET_PLAYER':      return { ...state, player: action.player };
    case 'SET_GAME':        return { ...state, gameState: action.gameState };
    case 'GAME_FINISHED':
      return {
        ...state,
        gameFinishedAt: Date.now(),
        gameState: state.gameState
          ? { ...state.gameState, status: 'finished' }
          : state.gameState,
      };
    case 'SET_ROUND':       return { ...state, roundResult: action.roundResult };
    case 'SET_LEADERBOARD': return { ...state, leaderboard: action.leaderboard };
    case 'SET_GAME_MODE':   return { ...state, gameMode: action.gameMode };
    case 'SET_INDIVIDUAL_PLAYERS': return { ...state, individualPlayers: action.players };
    case 'SET_INDIVIDUAL_ROUND_ANSWERS': return { ...state, individualAnswers: action.answers };
    case 'SET_INDIVIDUAL_ANSWER_UPDATE':
      return {
        ...state,
        individualAnswers: { ...state.individualAnswers, [action.data.socketId]: action.data },
        individualPlayers: action.data.leaderboard || state.individualPlayers,
        // Also update gameState so LiveControl can display it live
        gameState: state.gameState ? {
          ...state.gameState,
          individualAnswers: { ...(state.gameState.individualAnswers||{}), [action.data.socketId]: action.data },
          individualPlayers: action.data.leaderboard || state.gameState.individualPlayers,
        } : state.gameState,
      };
    case 'SET_CONNECTED':   return { ...state, connected: action.connected };
    case 'SET_ERROR':       return { ...state, error: action.error };

    case 'ADD_TOPIC': {
      const newMeta = { ...state.topicMeta, [action.name]: { emoji: action.emoji || '📚', color: action.color || '#4F8CFF' } };
      saveTopicMeta(newMeta); // persist
      return { ...state, topicMeta: newMeta };
    }
    case 'REMOVE_TOPIC': {
      const newMeta = { ...state.topicMeta };
      delete newMeta[action.name];
      saveTopicMeta(newMeta); // persist
      return { ...state, topicMeta: newMeta };
    }

    case 'TIMER_TICK':
      if (!state.gameState) return state;
      return { ...state, gameState: { ...state.gameState, timerRemaining: action.remaining, timerRunning: true } };
    case 'TIMER_PAUSE':
      if (!state.gameState) return state;
      return { ...state, gameState: { ...state.gameState, timerRemaining: action.remaining, timerRunning: false } };
    case 'TIMER_RESUME':
      if (!state.gameState) return state;
      return { ...state, gameState: { ...state.gameState, timerRunning: true } };
    case 'TIMER_SETTINGS':
      if (!state.gameState) return state;
      return { ...state, gameState: { ...state.gameState, timerSeconds: action.timerSeconds } };

    case 'ADD_TOAST': {
      const t = { id: Date.now() + Math.random(), msg: action.msg, type: action.toastType || 'info' };
      return { ...state, toasts: [...state.toasts, t] };
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };

    case 'RESET':
      return { ...INITIAL, topicMeta: state.topicMeta };

    // Mentor logout: clear all session state but stay on mentor side (mentor-gate)
    case 'MENTOR_LOGOUT':
      return { ...INITIAL, topicMeta: state.topicMeta, screen: 'mentor-gate' };

    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const go    = useCallback(screen => dispatch({ type:'SET_SCREEN', screen }), []);
  const toast = useCallback((msg, type='info') => dispatch({ type:'ADD_TOAST', msg, toastType:type }), []);
  return (
    <AppContext.Provider value={{ state, dispatch, go, toast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp()  { return useContext(AppContext); }
export function useGame() { return useContext(AppContext).state.gameState; }

export function getTopicEmoji(name, topicMeta) {
  return topicMeta?.[name]?.emoji || DEFAULT_TOPIC_META[name]?.emoji || '📚';
}
export function getTopicColor(name, topicMeta) {
  return topicMeta?.[name]?.color || DEFAULT_TOPIC_META[name]?.color || '#4F8CFF';
}
