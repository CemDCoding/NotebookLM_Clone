const TIME_ZONE = 'Europe/Berlin';

const berlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/**
 * Start of the calendar day in Europe/Berlin that contains `now`, as an
 * instant. Global daily limits reset at German midnight, not at UTC midnight
 * (PE-10), so a German user's "today" matches the limit's.
 */
export function startOfBerlinDay(now: Date): Date {
  const { year, month, day } = wallClock(now);
  const utcMidnight = Date.UTC(year, month - 1, day);
  // UTC midnight is 01:00 or 02:00 in Berlin on the same day. The clocks change
  // at 02:00/03:00 local time, never between midnight and then, so the offset
  // at UTC midnight equals the offset at Berlin midnight.
  return new Date(utcMidnight - offsetMs(new Date(utcMidnight)));
}

/** How far Berlin's wall clock is ahead of UTC at `instant`. */
function offsetMs(instant: Date): number {
  const { year, month, day, hour, minute, second } = wallClock(instant);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantWithoutMs = Math.floor(instant.getTime() / 1000) * 1000;
  return wallAsUtc - instantWithoutMs;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instant: Date): WallClock {
  const parts = berlinParts.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Intl.DateTimeFormat returned no "${type}" part`);
    }
    return Number(value);
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}
