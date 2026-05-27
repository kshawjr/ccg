'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLOR_HEX,
  COLOR_LABEL,
  DEFINITIONS,
  PRIMARY_DESCRIPTION,
  ROUND_VIBES,
  ROWS,
} from '@/lib/data';
import { calculateScores, isComplete, primaryColor } from '@/lib/scoring';
import type { Color, Responses, Scores } from '@/lib/types';

type Props = {
  token: string;
  firstName: string;
  initialResponses: Responses;
  alreadyComplete: boolean;
  savedPrimary: Color | null;
  savedScores: Scores | null;
};

type Phase = 'welcome1' | 'welcome2' | 'quiz' | 'results';

// TODO: make these per-token / env-driven once we have more than one franchise.
const RECIPIENT_NAME = 'Andrea';
const FRANCHISE_NAME = 'Corporate Cleaning Group';

const LS_KEY = (token: string) => `true-colors:${token}`;
const LONG_PRESS_MS = 380;
const PRESS_MOVE_THRESHOLD = 10;
const TIP_LINGER_MS = 2400;
const AUTOSAVE_DEBOUNCE_MS = 500;
const ROW_LEAVE_MS = 700;
const RESULTS_DELAY_MS = 900;

export default function Assessment(props: Props) {
  const { token, firstName, initialResponses, alreadyComplete, savedPrimary, savedScores } = props;

  const reducedMotion = usePrefersReducedMotion();

  // ----- ?reset=1 clears localStorage -----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('reset') === '1') {
      window.localStorage.removeItem(LS_KEY(token));
    }
  }, [token]);

  // ----- Restore responses (server is source of truth, LS is fallback) -----
  const [responses, setResponses] = useState<Responses>(() => {
    if (typeof window === 'undefined') return initialResponses;
    if (alreadyComplete) return initialResponses;
    // If server has any rankings already, prefer that.
    const serverHasData = initialResponses.some((row) => row.some((c) => c !== null));
    if (serverHasData) return initialResponses;
    try {
      const raw = window.localStorage.getItem(LS_KEY(token));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 6) {
          // Defensive deep clone so no two rows share an inner array reference.
          return parsed.map((r: unknown) =>
            Array.isArray(r) && r.length === 4 ? [...r] : [null, null, null, null],
          ) as Responses;
        }
      }
    } catch {
      /* ignore */
    }
    return initialResponses;
  });

  const [phase, setPhase] = useState<Phase>(() => {
    if (alreadyComplete) return 'results';
    return 'welcome1';
  });
  const [modalLeaving, setModalLeaving] = useState(false);

  const initialRound = useMemo(() => {
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].some((c) => c === null)) return i;
    }
    return 5;
  }, [responses]);
  const [currentRound, setCurrentRound] = useState<number>(initialRound);
  const [rowLeaving, setRowLeaving] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [enterKey, setEnterKey] = useState(0); // bump to retrigger CSS enter animation

  const [tip, setTip] = useState<{ word: string; def: string; x: number; y: number; visible: boolean } | null>(null);

  // Submit/sync
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>(
    alreadyComplete ? 'done' : 'idle',
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  // Final result scores
  const finalScores: Scores = useMemo(() => {
    if (alreadyComplete && savedScores) return savedScores;
    return calculateScores(responses);
  }, [alreadyComplete, savedScores, responses]);

  const finalPrimary: Color = useMemo(() => {
    if (alreadyComplete && savedPrimary) return savedPrimary;
    return primaryColor(finalScores);
  }, [alreadyComplete, savedPrimary, finalScores]);

  // ----- Autosave (debounced) -----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (alreadyComplete) return;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_KEY(token), JSON.stringify(responses));
      } catch {
        /* ignore quota */
      }
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/save/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
        keepalive: true,
      }).catch(() => {
        /* server is best-effort; LS holds the fallback */
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [responses, token, alreadyComplete]);

  // ----- Long-press handlers -----
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressActiveCard = useRef<HTMLElement | null>(null);
  const pendingPreventClick = useRef(false);
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
    if (pressActiveCard.current) {
      pressActiveCard.current.removeAttribute('data-pressed');
      pressActiveCard.current = null;
    }
  }, []);

  const hideTipSoon = useCallback(() => {
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    tipHideTimer.current = setTimeout(() => {
      setTip((t) => (t ? { ...t, visible: false } : t));
      // Remove from DOM after the fade.
      setTimeout(() => setTip(null), 220);
    }, TIP_LINGER_MS);
  }, []);

  const onWordPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const word = target.dataset.word;
      if (!word) return;
      const def = DEFINITIONS[word] || '';
      pressStart.current = { x: e.clientX, y: e.clientY };
      const cardEl = target.closest('.card') as HTMLElement | null;
      pressActiveCard.current = cardEl;
      if (cardEl) cardEl.setAttribute('data-pressed', '1');

      pressTimer.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        setTip({
          word,
          def,
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          visible: true,
        });
        pendingPreventClick.current = true;
        setTimeout(() => {
          pendingPreventClick.current = false;
        }, 100);
        hideTipSoon();
      }, LONG_PRESS_MS);
    },
    [hideTipSoon],
  );

  const onWordPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pressStart.current) return;
      const dx = e.clientX - pressStart.current.x;
      const dy = e.clientY - pressStart.current.y;
      if (Math.hypot(dx, dy) > PRESS_MOVE_THRESHOLD) {
        clearPress();
      }
    },
    [clearPress],
  );

  const onWordPointerUp = useCallback(() => {
    clearPress();
  }, [clearPress]);

  const onWordPointerCancel = useCallback(() => {
    clearPress();
  }, [clearPress]);

  // Hide tooltip globally on scroll.
  useEffect(() => {
    const handler = () => {
      if (tip) {
        setTip((t) => (t ? { ...t, visible: false } : t));
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [tip]);

  // ----- Card click (rank) -----
  const ranksUsed = (row: Array<number | null>) =>
    new Set(row.filter((v): v is number => v !== null));

  const nextRank = (row: Array<number | null>): number | null => {
    const used = ranksUsed(row);
    for (const r of [4, 3, 2, 1]) {
      if (!used.has(r)) return r;
    }
    return null;
  };

  const confettiOriginRef = useRef<HTMLDivElement | null>(null);
  const [burstSeed, setBurstSeed] = useState(0);

  // Always-fresh re-entry guard. Refs (unlike state) update synchronously, so
  // a second caller within the same tick sees `true` and bails. This is the
  // belt to the suspenders of keeping advance-scheduling out of state updaters.
  const advancingRef = useRef(false);

  const advanceRow = useCallback(() => {
    if (advancingRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[true-colors] advanceRow re-entered while advance in flight — ignoring');
      }
      return;
    }
    advancingRef.current = true;
    setRowLeaving(true);
    setIsAdvancing(true);
    setBurstSeed((n) => n + 1); // confetti
    const leaveMs = reducedMotion ? 60 : ROW_LEAVE_MS;
    setTimeout(() => {
      advancingRef.current = false;
      setRowLeaving(false);
      setIsAdvancing(false);
      setCurrentRound((r) => Math.min(r + 1, 5));
      setEnterKey((k) => k + 1);
    }, leaveMs);
  }, [reducedMotion]);

  // After row 6 completes, kick off submit then show results.
  const triggerSubmit = useCallback(
    async (finalResponses: Responses) => {
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const res = await fetch(`/api/submit/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses: finalResponses }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || `Submit failed (${res.status})`);
        }
        setSyncStatus('done');
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : String(err));
      }
    },
    [token],
  );

  const onCardClick = useCallback(
    (rowIdx: number, clusterIdx: number) => {
      if (pendingPreventClick.current) return;
      if (isAdvancing) return;
      if (rowIdx !== currentRound) return;

      // Compute the new state from the current snapshot, then call setResponses
      // with a plain value. The previous version scheduled setTimeout(advanceRow)
      // *inside* a setResponses((prev) => ...) updater — React 18 may invoke
      // updater functions more than once, which double-fired the advance and
      // skipped every other row.
      const currentRow = responses[rowIdx];
      const newRow: Array<number | null> = [...currentRow];
      const cellVal = newRow[clusterIdx];

      if (cellVal !== null) {
        // Undo this rank and all lower ranks.
        for (let i = 0; i < newRow.length; i++) {
          const v = newRow[i];
          if (v !== null && v <= cellVal) newRow[i] = null;
        }
      } else {
        const nr = nextRank(newRow);
        if (nr === null) return;
        newRow[clusterIdx] = nr;
      }

      const newResponses: Responses = responses.map((r, i) =>
        i === rowIdx ? newRow : [...r],
      );
      setResponses(newResponses);

      const rowComplete = newRow.every((v) => v !== null);
      if (!rowComplete) return;

      if (rowIdx === 5) {
        if (isComplete(newResponses)) {
          setTimeout(() => {
            setPhase('results');
            void triggerSubmit(newResponses);
          }, RESULTS_DELAY_MS);
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[true-colors] final row complete but responses still incomplete',
            newResponses,
          );
        }
      } else {
        setTimeout(() => advanceRow(), 220);
      }
    },
    [currentRound, isAdvancing, responses, advanceRow, triggerSubmit],
  );

  const onResetRow = useCallback(() => {
    setResponses((prev) => {
      const next = prev.map((r) => [...r]) as Responses;
      next[currentRound] = [null, null, null, null];
      return next;
    });
  }, [currentRound]);

  const onPrevRound = useCallback(() => {
    if (currentRound === 0) return;
    setResponses((prev) => {
      const next = prev.map((r) => [...r]) as Responses;
      // Clear previous row so user can re-rank fresh.
      next[currentRound - 1] = [null, null, null, null];
      return next;
    });
    setCurrentRound((r) => Math.max(r - 1, 0));
    setEnterKey((k) => k + 1);
  }, [currentRound]);

  const onBeginQuiz = useCallback(() => {
    setModalLeaving(true);
    setTimeout(() => {
      setPhase('welcome2');
      setModalLeaving(false);
    }, 350);
  }, []);

  const onContinueQuiz = useCallback(() => {
    setModalLeaving(true);
    setTimeout(() => {
      setPhase('quiz');
      setModalLeaving(false);
      setEnterKey((k) => k + 1);
    }, 350);
  }, []);

  const onRetrySubmit = useCallback(() => {
    void triggerSubmit(responses);
  }, [triggerSubmit, responses]);

  // Number of ranks placed in current row, for the instruction text.
  const ranksPlaced = responses[currentRound].filter((v) => v !== null).length;
  const rowDone = ranksPlaced === 4;
  const instructionText = (() => {
    if (rowDone) return `Round ${currentRound + 1} complete. Tap a card to undo.`;
    const stepLabels = [
      'tap the group most like you.',
      'now pick the group second-most like you.',
      'now pick the group third-most like you.',
      'now pick the group least like you.',
    ];
    return `Round ${currentRound + 1} of 6 — ${stepLabels[ranksPlaced]}`;
  })();

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  return (
    <>
      {phase === 'welcome1' && (
        <Welcome1
          firstName={firstName}
          leaving={modalLeaving}
          onBegin={onBeginQuiz}
        />
      )}
      {phase === 'welcome2' && (
        <Welcome2 leaving={modalLeaving} onContinue={onContinueQuiz} />
      )}

      {phase === 'quiz' && (
        <main className="app">
          <div className="app-inner">
            <p className="greeting">
              Hi <strong>{firstName}</strong> — let&rsquo;s find your colors
            </p>
            <div className="title-row">
              <h2 className="title">True colors</h2>
              <div className="round-mark" aria-hidden="true">
                <RoundMotif round={currentRound} />
                <span className="round-pill">{ROUND_VIBES[currentRound]}</span>
              </div>
            </div>

            <div className="progress" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => {
                const cls =
                  i < currentRound ? 'done' : i === currentRound ? 'current' : '';
                return <span key={i} className={cls} />;
              })}
            </div>

            <p className="instruction" aria-live="polite">{instructionText}</p>

            <div
              key={enterKey}
              className={
                'grid ' +
                (rowLeaving ? 'row-leaving ' : '') +
                (rowLeaving ? '' : `enter-r${currentRound + 1}`)
              }
              style={{ borderRadius: 0 }}
            >
              {ROWS[currentRound].map((cluster, ci) => {
                const rank = responses[currentRound][ci];
                const rankColor = rank !== null ? cluster.color : null;
                return (
                  <button
                    key={ci}
                    className="card"
                    data-rank-color={rankColor || ''}
                    style={{ borderRadius: cardRadius(currentRound) }}
                    onClick={() => onCardClick(currentRound, ci)}
                    type="button"
                  >
                    {rank !== null && (
                      <span
                        className="badge"
                        style={{ background: COLOR_HEX[cluster.color] }}
                      >
                        {rank}
                      </span>
                    )}
                    {cluster.words.map((w, wi) => (
                      <div
                        key={wi}
                        className={`word${wi === 0 ? ' lead' : ''}`}
                        data-word={w}
                        onPointerDown={onWordPointerDown}
                        onPointerMove={onWordPointerMove}
                        onPointerUp={onWordPointerUp}
                        onPointerCancel={onWordPointerCancel}
                        onPointerLeave={onWordPointerCancel}
                      >
                        {w}
                      </div>
                    ))}
                  </button>
                );
              })}

              {/* confetti origin near the round mark dot */}
              <div
                ref={confettiOriginRef}
                className="confetti-burst"
                style={{ top: -30, right: 10 }}
                aria-hidden="true"
              >
                {burstSeed > 0 && (
                  <ConfettiBurst
                    seed={burstSeed}
                    color={COLOR_HEX[ROWS[currentRound][0].color]}
                  />
                )}
              </div>
            </div>

            <div className="actions">
              <button
                type="button"
                className="btn"
                onClick={onPrevRound}
                disabled={currentRound === 0 || isAdvancing}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={onResetRow}
                disabled={ranksPlaced === 0 || isAdvancing}
              >
                Reset row
              </button>
            </div>
          </div>
        </main>
      )}

      {phase === 'results' && (
        <Results
          firstName={firstName}
          scores={finalScores}
          primary={finalPrimary}
          syncStatus={syncStatus}
          syncError={syncError}
          onRetry={onRetrySubmit}
          reducedMotion={reducedMotion}
        />
      )}

      {tip && (
        <div
          className={`tip${tip.visible ? ' show' : ''}`}
          style={{ left: tip.x, top: tip.y }}
          role="tooltip"
        >
          <b>{tip.word}</b>
          {tip.def}
        </div>
      )}
    </>
  );
}

// ============================================================
// Welcome screens
// ============================================================
function Welcome1({
  firstName,
  leaving,
  onBegin,
}: {
  firstName: string;
  leaving: boolean;
  onBegin: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className={`modal${leaving ? ' leaving' : ''}`}>
        <div className="welcome-dots" aria-hidden="true">
          <span style={{ background: COLOR_HEX.orange }} />
          <span style={{ background: COLOR_HEX.blue }} />
          <span style={{ background: COLOR_HEX.gold }} />
          <span style={{ background: COLOR_HEX.green }} />
        </div>
        <p className="eyebrow">True colors assessment</p>
        <h1>
          Hi <span className="name-gradient">{firstName}</span>
        </h1>
        <p className="body">
          This short personality check is part of the franchise development process with{' '}
          {FRANCHISE_NAME}. Your results will be shared with {RECIPIENT_NAME} to help us
          understand how you naturally show up, and how your style compares with other operators in
          our network.
        </p>
        <div className="divider" />
        <p className="meta">About 4 minutes · 6 short rounds · no wrong answers</p>
        <button type="button" className="btn primary" onClick={onBegin}>
          Let&rsquo;s begin →
        </button>
      </div>
    </div>
  );
}

function Welcome2({ leaving, onContinue }: { leaving: boolean; onContinue: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className={`modal${leaving ? ' leaving' : ''}`}>
        <p className="eyebrow">One quick tip</p>
        <h1>Stuck on a word?</h1>
        <div className="gesture-demo" aria-hidden="true">
          <span className="demo-ripple" />
          <div className="demo-card">Empathetic</div>
          <div className="demo-tip">
            <b>Empathetic</b> Feels what others feel.
          </div>
        </div>
        <p className="body">
          Press and hold any word during the assessment to peek at its definition.
        </p>
        <div className="divider" />
        <p className="meta">Works on every card, every round.</p>
        <button type="button" className="btn primary" onClick={onContinue}>
          Got it, let&rsquo;s go →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Results
// ============================================================
function Results({
  firstName,
  scores,
  primary,
  syncStatus,
  syncError,
  onRetry,
  reducedMotion,
}: {
  firstName: string;
  scores: Scores;
  primary: Color;
  syncStatus: 'idle' | 'syncing' | 'done' | 'error';
  syncError: string | null;
  onRetry: () => void;
  reducedMotion: boolean;
}) {
  const ordered = (['orange', 'blue', 'gold', 'green'] as Color[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  const max = Math.max(scores.orange, scores.blue, scores.gold, scores.green, 1);

  // Animate counting up.
  const [displayed, setDisplayed] = useState<Scores>({ orange: 0, blue: 0, gold: 0, green: 0 });
  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(scores);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed({
        orange: Math.round(scores.orange * ease),
        blue: Math.round(scores.blue * ease),
        gold: Math.round(scores.gold * ease),
        green: Math.round(scores.green * ease),
      });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scores, reducedMotion]);

  return (
    <main className="app">
      <div className="results">
        <p className="greeting">Nice work, {firstName}</p>
        <h1>Your true colors</h1>
        <p className="lede">Here is how your responses distribute across the four color types.</p>

        <div className="scoreboard">
          {ordered.map((c) => (
            <div key={c} className="score">
              <p className="score-label" style={{ color: COLOR_HEX[c] }}>
                {COLOR_LABEL[c]}
              </p>
              <p className="score-value">{displayed[c]}</p>
              <div className="score-bar">
                <i
                  style={{
                    background: COLOR_HEX[c],
                    width: `${(scores[c] / max) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="spotlight" style={{ borderColor: COLOR_HEX[primary] }}>
          <div>
            <p className="eyebrow">Your brightest color</p>
            <h2 style={{ color: COLOR_HEX[primary] }}>{COLOR_LABEL[primary]}</h2>
            <p>{PRIMARY_DESCRIPTION[primary]}</p>
          </div>
          <Donut scores={scores} />
          <CelebrationBursts color={COLOR_HEX[primary]} />
        </div>

        <div className="sync" aria-live="polite">
          {syncStatus === 'idle' && <span>Preparing your results…</span>}
          {syncStatus === 'syncing' && (
            <>
              <span className="spinner" />
              <span>Sending your results to {RECIPIENT_NAME}…</span>
            </>
          )}
          {syncStatus === 'done' && (
            <>
              <span className="check">✓</span>
              <span>Sent to {RECIPIENT_NAME} ✓</span>
            </>
          )}
          {syncStatus === 'error' && (
            <span style={{ color: '#7a2e10' }}>Couldn&rsquo;t reach the server.</span>
          )}
        </div>

        {syncStatus === 'error' && (
          <div className="error">
            <span>{syncError || 'Submission failed. You can try again.'}</span>
            <button type="button" className="btn primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================
// Donut (SVG)
// ============================================================
function Donut({ scores }: { scores: Scores }) {
  const total = scores.orange + scores.blue + scores.gold + scores.green || 1;
  const segs: { color: string; frac: number }[] = (
    ['orange', 'blue', 'gold', 'green'] as Color[]
  ).map((c) => ({ color: COLOR_HEX[c], frac: scores[c] / total }));

  const cx = 65, cy = 65, r = 50, sw = 14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg className="donut" viewBox="0 0 130 130" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#efece2" strokeWidth={sw} />
      {segs.map((s, i) => {
        const dash = s.frac * circ;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ============================================================
// Per-round motif SVG
// ============================================================
function RoundMotif({ round }: { round: number }) {
  switch (round) {
    case 0:
      return (
        <svg className="motif-dots" viewBox="0 0 32 32">
          <circle cx="7" cy="16" r="3" fill={COLOR_HEX.orange} />
          <circle cx="16" cy="16" r="3" fill={COLOR_HEX.blue} />
          <circle cx="25" cy="16" r="3" fill={COLOR_HEX.gold} />
        </svg>
      );
    case 1:
      return (
        <svg className="motif-wave" viewBox="0 0 32 32">
          <path
            d="M2 16 Q 8 6, 14 16 T 26 16 T 38 16"
            fill="none"
            stroke={COLOR_HEX.blue}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 2:
      return (
        <svg className="motif-ring" viewBox="0 0 32 32">
          <circle className="ring" cx="16" cy="16" r="12" />
          <rect className="sq" x="11" y="11" width="10" height="10" rx="2" fill={COLOR_HEX.gold} />
        </svg>
      );
    case 3:
      return (
        <svg className="motif-tri" viewBox="0 0 32 32">
          <polygon
            className="outline"
            points="16,5 28,26 4,26"
            fill="none"
            stroke={COLOR_HEX.green}
            strokeWidth="1.5"
          />
          <polygon className="tri" points="16,9 25,24 7,24" fill={COLOR_HEX.green} />
        </svg>
      );
    case 4:
      return (
        <svg className="motif-star" viewBox="0 0 32 32">
          <polygon
            points="16,4 19.5,12.5 28.5,12.5 21.2,18 24,26.5 16,21.3 8,26.5 10.8,18 3.5,12.5 12.5,12.5"
            fill={COLOR_HEX.orange}
          />
        </svg>
      );
    case 5:
    default:
      return (
        <svg className="motif-sun" viewBox="0 0 32 32">
          <g className="rays">
            <line x1="16" y1="2" x2="16" y2="8" stroke={COLOR_HEX.orange} strokeWidth="2" strokeLinecap="round" />
            <line x1="30" y1="16" x2="24" y2="16" stroke={COLOR_HEX.blue} strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="30" x2="16" y2="24" stroke={COLOR_HEX.gold} strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="16" x2="8" y2="16" stroke={COLOR_HEX.green} strokeWidth="2" strokeLinecap="round" />
            <line x1="26" y1="6" x2="22" y2="10" stroke={COLOR_HEX.orange} strokeWidth="2" strokeLinecap="round" />
            <line x1="26" y1="26" x2="22" y2="22" stroke={COLOR_HEX.blue} strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="26" x2="10" y2="22" stroke={COLOR_HEX.gold} strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="10" y2="10" stroke={COLOR_HEX.green} strokeWidth="2" strokeLinecap="round" />
          </g>
          <circle className="hub" cx="16" cy="16" r="4" fill="#1a1a1a" />
        </svg>
      );
  }
}

// ============================================================
// Confetti burst (advance celebration)
// ============================================================
function ConfettiBurst({ seed, color }: { seed: number; color: string }) {
  const particles = useMemo(() => {
    const colors = [color, COLOR_HEX.orange, COLOR_HEX.blue, COLOR_HEX.gold, COLOR_HEX.green];
    return Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 50 + Math.random() * 50;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: Math.random() * 540 - 270,
        bg: colors[i % colors.length],
        delay: Math.random() * 80,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  return (
    <>
      {particles.map((p, i) => (
        <span
          key={`${seed}-${i}`}
          style={{
            background: p.bg,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </>
  );
}

function CelebrationBursts({ color }: { color: string }) {
  return (
    <>
      <div className="confetti-burst" style={{ top: 20, left: 20 }}>
        <ConfettiBurst seed={1} color={color} />
      </div>
      <div className="confetti-burst" style={{ top: 40, right: 40 }}>
        <ConfettiBurst seed={2} color={color} />
      </div>
      <div className="confetti-burst" style={{ top: 60, left: '50%' }}>
        <ConfettiBurst seed={3} color={color} />
      </div>
    </>
  );
}

// ============================================================
// Helpers
// ============================================================
function cardRadius(round: number): string {
  switch (round) {
    case 0:
      return '16px';
    case 1:
      return '30px 10px 30px 10px';
    case 2:
      return '28px';
    case 3:
      return '8px 28px 8px 28px';
    case 4:
      return '26px 26px 6px 6px';
    case 5:
    default:
      return '48px';
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);
  return reduced;
}
