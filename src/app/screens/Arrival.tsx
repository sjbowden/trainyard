import { useEffect, useState } from 'preact/hooks';

/** How long "Now in <city>" stays before it has faded out. */
const SHOWN_MS = 4000;

/**
 * A brief line saying Next has moved on to a new city. It floats over the top of the board and
 * ignores taps, and waits while `waiting` (the city's tutorial is open) so it isn't missed.
 */
export function Arrival({ city, waiting }: { city: string; waiting: boolean }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (waiting) return;
    const t = setTimeout(() => setDone(true), SHOWN_MS);
    return () => clearTimeout(t);
  }, [waiting]);
  if (waiting || done) return null;
  return (
    <p class="arrival" role="status">
      Now in {city}
    </p>
  );
}
