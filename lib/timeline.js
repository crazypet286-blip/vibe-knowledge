// 场景时间轴切片封装
export function sceneTimeline(raw, sceneName) {
  const ids = raw.scenes[sceneName];
  if (!ids) throw new Error('未知场景: ' + sceneName);
  const shots = ids.map(id => raw.shots.find(s => s.id === id));
  const absStart = shots[0].start;
  const absEnd = shots[shots.length - 1].end;
  const duration = absEnd - absStart;
  const localShots = shots.map(s => ({
    ...s,
    absStart: s.start,
    absEnd: s.end,
    start: s.start - absStart,
    end: s.end - absStart,
    dur: s.end - s.start,
  }));
  return {
    sceneName,
    absStart,
    absEnd,
    duration,
    shots: localShots,
    shot(id) {
      return localShots.find(s => s.id === id) || localShots[0];
    },
    current(t) {
      return localShots.find(s => t >= s.start && t <= s.end) || localShots[localShots.length - 1];
    },
  };
}
