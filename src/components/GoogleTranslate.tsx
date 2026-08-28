'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { Languages } from 'lucide-react';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

const SCRIPT_ID = 'google-translate-script';

function openLanguageSelect(select: HTMLSelectElement) {
  select.focus();
  const picker = (select as HTMLSelectElement & { showPicker?: () => void }).showPicker;
  if (typeof picker === 'function') {
    try {
      picker.call(select);
      return;
    } catch {
      // showPicker can throw if the browser does not treat this as a gesture.
    }
  }
  select.click();
}

/**
 * Inline Google Translate widget.
 * Lets an intake worker switch the page into the student's language so a
 * non-English speaker can follow along. Uses Google's free website translator.
 */
export default function GoogleTranslate() {
  const reactId = useId().replace(/:/g, '');
  const hostId = `google_translate_element_${reactId}`;
  const hostRef = useRef<HTMLDivElement>(null);

  const initWidget = useCallback(() => {
    const host = hostRef.current;
    const TranslateElement = window.google?.translate?.TranslateElement;
    if (!host || !TranslateElement) return;
    host.replaceChildren();
    // eslint-disable-next-line no-new
    new TranslateElement(
      {
        pageLanguage: 'en',
        layout: TranslateElement.InlineLayout.HORIZONTAL,
        autoDisplay: false,
      },
      host.id,
    );
  }, []);

  useEffect(() => {
    window.googleTranslateElementInit = initWidget;

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      document.body.appendChild(s);
    } else {
      initWidget();
    }

    return () => {
      hostRef.current?.replaceChildren();
    };
  }, [initWidget]);

  function handleOpen() {
    const select = hostRef.current?.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (select) openLanguageSelect(select);
  }

  return (
    <div className="gt-pill relative z-20 flex shrink-0 items-center gap-2 rounded-full border border-border bg-background pl-3 pr-1.5 py-1 shadow-sm">
      <button
        type="button"
        className="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground whitespace-nowrap"
        aria-label="Translate page language"
        onClick={handleOpen}
      >
        <Languages className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <span className="hidden md:inline">Translate</span>
      </button>
      <div ref={hostRef} id={hostId} className="min-w-[150px]" />
    </div>
  );
}
