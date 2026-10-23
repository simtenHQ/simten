/**
 * The tour: the welcome, then a walk round the level page, before the player
 * has to work out what goes where.
 *
 * Shown watching someone meet the game cold: they did not see Submit until
 * told, and did not realise the instructions were the comments in the editor.
 *
 * It runs on the first level page a newcomer opens (every level page has the
 * same layout, so a shared link to any level gets it), and "What is this?"
 * replays it. One flag records that it has been seen; see `isOnboarded`.
 *
 * driver.js is loaded only when the tour is about to run, so a returning
 * player never downloads it. Targets are `data-tour` attributes rather than
 * class names, so restyling the page cannot silently break a step. A step
 * whose target is not on screen (the spec sheet closed, say) is dropped rather
 * than pointing at nothing.
 */

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { isOnboarded, markOnboarded } from '../game/storage';
import { INTRO_TITLE, IntroCopy, IntroLogo } from './Welcome';

interface TourStep {
  target: string;
  title: string;
  description: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  align: 'start' | 'center' | 'end';
}

type Button = 'next' | 'previous' | 'close';

const STEPS: TourStep[] = [
  {
    target: 'editor',
    title: 'Code editor',
    // driver.js renders descriptions as HTML.
    description:
      '<p>Your circuit is TypeScript, written with <code>circuit()</code>:</p>' +
      '<ul><li><code>nodes</code> lists the parts: switches, gates, LEDs</li>' +
      '<li><code>connect</code> wires them, like <code>a.out.to(n1.a)</code></li></ul>' +
      '<p>The circuit on the right redraws as you type.</p>',
    side: 'right',
    align: 'start',
  },
  {
    target: 'canvas',
    title: 'Circuit canvas',
    description:
      'Every wire you write shows up here. Click a switch to try your circuit before you submit it.',
    side: 'left',
    align: 'start',
  },
  {
    target: 'spec',
    title: 'Spec',
    description:
      'What your circuit has to do: the outputs it must give for each input, or for each step on levels with memory. The list beside it is everything you can build with.',
    side: 'top',
    align: 'start',
  },
  {
    target: 'submit',
    title: 'Submit',
    description:
      'Press Submit to check your circuit against the spec. Feedback, at the bottom right, says what happened.',
    side: 'bottom',
    align: 'end',
  },
];

/** driver.js and its stylesheet, fetched on first use. */
const loadDriver = () =>
  Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]).then(([m]) => m.driver);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the tour when `ready` (no dialog open that it would land on) and the
 * player has not been onboarded. Each increment of `replays` runs it again
 * regardless, which is what "What is this?" does.
 *
 * Returns whether the tour is scheduled or showing, so the page can hold its
 * own explainers back until it is over.
 */
export function useOnboardingTour(ready: boolean, replays: number): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ready || (replays === 0 && isOnboarded())) return;
    setActive(true);

    let cancelled = false;
    let destroy: (() => void) | undefined;
    // The React root holding the welcome inside the opening card.
    let welcomeRoot: Root | null = null;
    const unmountWelcome = () => {
      welcomeRoot?.unmount();
      welcomeRoot = null;
    };

    // A beat after readiness: long enough for the page's fade-in (150ms) or a
    // dialog's close (200ms) to finish, so the first card does not land on
    // something still moving. The download runs alongside the pause rather
    // than after it.
    void Promise.all([loadDriver(), pause(200)]).then(([driver]) => {
      if (cancelled) return;

      const welcome = {
        popover: {
          // The title lives in the body, under the logo.
          title: '',
          description: ' ',
          popoverClass: 'simten-tour simten-tour-wide',
          // Nothing to go back to on the opening card.
          showButtons: ['next', 'close'] as Button[],
          // driver.js only takes text or HTML, so mount the welcome components
          // into the card rather than keeping a second copy of the words.
          onPopoverRender: (popover: { description: HTMLElement }) => {
            unmountWelcome();
            popover.description.style.display = 'block';
            welcomeRoot = createRoot(popover.description);
            // Rendered synchronously, then re-measured: driver.js placed the
            // card at its placeholder size, and it would otherwise grow down and
            // to the right from there instead of staying centred.
            flushSync(() =>
              welcomeRoot?.render(
                <>
                  <IntroLogo />
                  <h2 className="mb-2 text-lg font-semibold text-popover-foreground">
                    {INTRO_TITLE}
                  </h2>
                  <IntroCopy className="space-y-2" ending="Here is a quick look round the page." />
                </>,
              ),
            );
            requestAnimationFrame(() => tour.refresh());
          },
        },
        onDeselected: unmountWelcome,
      };

      const page = STEPS.filter((s) => document.querySelector(`[data-tour="${s.target}"]`)).map(
        (s) => ({
          element: `[data-tour="${s.target}"]`,
          popover: {
            title: s.title,
            description: s.description,
            side: s.side,
            align: s.align,
            showButtons: ['next', 'previous', 'close'] as Button[],
          },
        }),
      );

      const tour = driver({
        steps: [welcome, ...page],
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Start building',
        popoverClass: 'simten-tour',
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 8,
        // Only a player ending it counts: finishing, the close button, Escape,
        // or a click on the overlay. The unmount cleanup below calls destroy()
        // directly, which skips this hook, so a hot reload or navigating away
        // mid-tour leaves it to show again.
        onDestroyStarted: () => {
          markOnboarded();
          tour.destroy();
        },
        onDestroyed: () => {
          unmountWelcome();
          setActive(false);
        },
      });
      destroy = () => tour.destroy();
      tour.drive();
    });

    return () => {
      cancelled = true;
      destroy?.();
      unmountWelcome();
      setActive(false);
    };
  }, [ready, replays]);

  return active;
}
