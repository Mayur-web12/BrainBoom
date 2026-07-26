import { useEffect, useCallback } from 'react';
import { getSocket, connectSocket } from '../utils/socket';
import { useApp } from '../context/AppContext';

export function useSocketSetup() {
  const { dispatch, go, toast } = useApp();

  useEffect(() => {
    const s = connectSocket();

    s.on('connect',       () => dispatch({ type:'SET_CONNECTED', connected:true }));
    s.on('connect_error', () => {
      dispatch({ type:'SET_CONNECTED', connected:false });
      dispatch({ type:'SET_ERROR', error:'Cannot connect — make sure backend is running on port 4000.' });
    });
    s.on('disconnect', () => {
      dispatch({ type:'SET_CONNECTED', connected:false });
      toast('⚠️ Connection lost. Reconnecting…', 'error');
    });

    // Lobby updates — silent, just refresh state
    s.on('lobby-update', ({ state, individualPlayers }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: individualPlayers });
    });

    // Game started — one toast, navigate
    s.on('game-started', ({ state }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (state.individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: state.individualPlayers });
      dispatch({ type:'SET_ROUND', roundResult: null });
      toast('🚀 Game started!', 'success');
      go('topic-pick');
    });

    // Topic picked → navigate silently (topic info already shown on screen)
    s.on('question-started', ({ state }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (state.individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: state.individualPlayers });
      dispatch({ type:'SET_ROUND', roundResult: null });
      dispatch({ type:'SET_INDIVIDUAL_ROUND_ANSWERS', answers: {} });
      go('game');
    });

    // TEAM MODE round result — one toast for the key outcome
    s.on('round-result', ({ state, summary, result, timedOut }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (state.individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: state.individualPlayers });
      dispatch({ type:'SET_ROUND', roundResult: { state, summary, result, timedOut, mode:'team' } });
      if (timedOut) {
        toast(`⏰ Time's Up! ${summary?.teamName} missed the question.`, 'error');
      } else if (result?.correct) {
        toast(`✅ Correct! +${result.totalChange} pts`, 'success');
      } else {
        toast(`❌ Wrong answer! ${result?.totalChange} pts`, 'error');
      }
      go('round-result');
    });

    // INDIVIDUAL MODE — live answer updates: only toast on mentor side (handled in dispatch)
    s.on('individual-answer-update', (data) => {
      dispatch({ type:'SET_INDIVIDUAL_ANSWER_UPDATE', data });
      // No toast here — mentor sees live panel; student sees their own result
    });

    // INDIVIDUAL MODE round result — one toast
    s.on('individual-round-result', ({ state, summary, timedOut }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (state.individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: state.individualPlayers });
      dispatch({ type:'SET_ROUND', roundResult: { state, summary, timedOut, mode:'individual' } });
      if (timedOut) toast('⏰ Time\'s Up! Round over.', 'error');
      go('round-result');
    });

    // Next topic pick — silent navigation (screen already shows whose turn)
    s.on('topic-pick-phase', ({ state }) => {
      dispatch({ type:'SET_GAME', gameState: state });
      if (state.individualPlayers) dispatch({ type:'SET_INDIVIDUAL_PLAYERS', players: state.individualPlayers });
      dispatch({ type:'SET_ROUND', roundResult: null });
      go('topic-pick');
    });

    // Timer — only toast at 5 seconds (one meaningful warning)
    s.on('timer-tick', ({ remaining }) => {
      dispatch({ type:'TIMER_TICK', remaining });
      if (remaining === 5) toast('⏰ 5 seconds left!', 'error');
    });

    // Timer control — only on error, skip info toasts
    s.on('timer-paused',  ({ remaining }) => dispatch({ type:'TIMER_PAUSE', remaining }));
    s.on('timer-resumed', ()              => dispatch({ type:'TIMER_RESUME' }));
    s.on('timer-settings-updated', ({ timerSeconds }) => {
      dispatch({ type:'TIMER_SETTINGS', timerSeconds });
      // No toast — mentor sees the timer update on screen
    });

    // Game over — update game state to finished + navigate
    s.on('game-over', ({ leaderboard, mode }) => {
      dispatch({ type:'SET_LEADERBOARD', leaderboard });
      dispatch({ type:'SET_GAME_MODE', gameMode: mode || 'team' });
      // Mark the gameState as finished so LiveControl shows the completed state
      dispatch({ type:'GAME_FINISHED' });
      toast('🏁 Game over! See the final results.', 'success');
      go('final-leaderboard');
    });

    return () => {
      ['connect','disconnect','connect_error','lobby-update','game-started',
       'question-started','round-result','individual-answer-update','individual-round-result',
       'topic-pick-phase','timer-tick','timer-paused','timer-resumed',
       'timer-settings-updated','game-over'
      ].forEach(e => s.off(e));
    };
  }, [dispatch, go, toast]);
}

export function useEmit() {
  const { toast } = useApp();
  return useCallback(async (event, data) => {
    const s = getSocket();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Socket timeout — is backend running?')), 8000);
      s.emit(event, data, res => {
        clearTimeout(t);
        if (res?.ok === false) {
          toast(res.error || 'Something went wrong', 'error');
          reject(new Error(res.error));
        } else {
          resolve(res);
        }
      });
    });
  }, [toast]);
}
