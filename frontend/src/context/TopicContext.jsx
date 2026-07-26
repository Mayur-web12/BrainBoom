/**
 * TopicContext — single source of truth for topic metadata.
 * Both MentorDash and GameScreens import from here so adding a topic
 * in one place updates ALL screens automatically.
 */

// Default seed topics — mentor can add/remove at runtime
export const DEFAULT_TOPICS = {
  Math:      { emoji:'📐', color:'#4F8CFF' },
  Science:   { emoji:'🔬', color:'#7B61FF' },
  History:   { emoji:'🏛️',  color:'#FF8C42' },
  Geography: { emoji:'🌍', color:'#00D4AA' },
  Computer:  { emoji:'💻', color:'#FFD93D' },
  English:   { emoji:'📖', color:'#FF6B9D' },
  General:   { emoji:'🌟', color:'#FF5252' },
  Sabha:     { emoji:'🙏', color:'#F59E0B' },
};

/** Get emoji for a topic name (works for custom topics too) */
export function topicEmoji(name, customTopics = {}) {
  return customTopics[name]?.emoji || DEFAULT_TOPICS[name]?.emoji || '📚';
}

/** Get color for a topic name */
export function topicColor(name, customTopics = {}) {
  return customTopics[name]?.color || DEFAULT_TOPICS[name]?.color || '#4F8CFF';
}

/** Merge default topics with custom ones added by mentor */
export function mergeTopics(customList = [], customMeta = {}) {
  const all = { ...DEFAULT_TOPICS, ...customMeta };
  // Make sure every topic in customList exists in all
  customList.forEach(name => {
    if (!all[name]) all[name] = { emoji: '📚', color: '#4F8CFF' };
  });
  return all;
}
