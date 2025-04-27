const useMatomoTracking = () => {
  const trackEvent = (category, action, name, value) => {
    if (window._mtm) {
      window._mtm.push({
        'event': 'mtm.Event',
        'eventCategory': category,
        'eventAction': action,
        'eventName': name,
        'eventValue': value
      });
    }
  };

  const trackGameStart = (gameId) => {
    trackEvent('Game', 'Start', 'Game Started', gameId);
  };

  const trackGameEnd = (gameId, score) => {
    trackEvent('Game', 'End', 'Game Ended', score);
  };

  const trackAnswer = (gameId, isCorrect, timeLeft) => {
    trackEvent('Game', 'Answer', isCorrect ? 'Correct Answer' : 'Wrong Answer', timeLeft);
  };

  const trackPlayerJoin = (gameId) => {
    trackEvent('Game', 'Join', 'Player Joined', gameId);
  };

  const trackPlayerLeave = (gameId) => {
    trackEvent('Game', 'Leave', 'Player Left', gameId);
  };

  return {
    trackEvent,
    trackGameStart,
    trackGameEnd,
    trackAnswer,
    trackPlayerJoin,
    trackPlayerLeave
  };
};

export default useMatomoTracking; 