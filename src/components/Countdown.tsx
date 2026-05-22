interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(target: Date, now: number): TimeLeft {
  const targetTime = target.getTime();
  if (isNaN(targetTime)) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const diff = targetTime - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

interface Props {
  target: string;
  now: number;
}

export function Countdown({ target, now }: Props) {
  const t = calcTimeLeft(new Date(target), now);

  if (t.days === 0 && t.hours === 0 && t.minutes === 0 && t.seconds === 0) {
    return <span>Unlocked</span>;
  }

  return (
    <span className="tabular-nums tracking-wide">
      {t.days}d {String(t.hours).padStart(2, '0')}h{' '}
      {String(t.minutes).padStart(2, '0')}m{' '}
      {String(t.seconds).padStart(2, '0')}s
    </span>
  );
}
