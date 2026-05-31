'use client';

import { useEffect } from 'react';
import { Languages } from 'lucide-react';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

const SCRIPT_ID = 'google-translate-script';

/**
 * Inline Google Translate widget.
 * Lets an intake worker switch the page into the student's language so a
 * non-English speaker can follow along. Uses Google's free website translator.
 */
export default function GoogleTranslate() {
  useEffect(() => {
    // Define the global init callback Google's script calls when it loads.
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        // eslint-disable-next-line no-new
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            // No includedLanguages → ALL of Google's ~130 languages are offered,
            // which matters for NYC's huge linguistic diversity.
            // Default layout renders a native <select> (.goog-te-combo) which is
            // reliable and fully styleable — unlike SIMPLE which opens a popup
            // iframe menu that's awkward to theme.
            layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
            autoDisplay: false,
          },
          'google_translate_element',
        );
      }
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      document.body.appendChild(s);
    } else if (window.google?.translate?.TranslateElement) {
      // Script already present (e.g. client-side navigation) — re-init.
      window.googleTranslateElementInit();
    }
  }, []);

  return (
    <div className="gt-pill flex items-center gap-2 rounded-full border border-border bg-background pl-3 pr-1.5 py-1 shadow-sm">
      <Languages className="h-4 w-4 text-primary shrink-0" />
      <span className="hidden md:inline text-xs font-medium text-muted-foreground select-none whitespace-nowrap">
        Translate
      </span>
      <div id="google_translate_element" />
    </div>
  );
}
