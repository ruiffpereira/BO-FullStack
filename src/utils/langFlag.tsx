import React from "react";
import * as Flags from "country-flag-icons/react/3x2";

const LANG_TO_COUNTRY: Record<string, string> = {
  pt: "PT",
  br: "BR",
  en: "GB",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  nl: "NL",
  pl: "PL",
  ru: "RU",
  uk: "UA",
  zh: "CN",
  ja: "JP",
  ar: "SA",
  ro: "RO",
  hu: "HU",
  cs: "CZ",
  tr: "TR",
  sv: "SE",
  da: "DK",
  fi: "FI",
  nb: "NO",
};

interface LangFlagProps {
  code: string;
  className?: string;
}

export function LangFlag({ code, className = "h-4 w-auto rounded-sm" }: LangFlagProps) {
  const countryCode = LANG_TO_COUNTRY[code];
  if (!countryCode) {
    return (
      <span className="inline-flex items-center justify-center rounded-sm bg-zinc-200 dark:bg-zinc-700 text-[9px] font-bold text-zinc-600 dark:text-zinc-300 w-6 h-4">
        {code.toUpperCase().slice(0, 2)}
      </span>
    );
  }
  const Flag = (Flags as unknown as Record<string, (props: React.SVGAttributes<SVGElement> & React.HTMLAttributes<SVGElement>) => React.JSX.Element>)[countryCode];
  if (!Flag) {
    return (
      <span className="inline-flex items-center justify-center rounded-sm bg-zinc-200 dark:bg-zinc-700 text-[9px] font-bold text-zinc-600 dark:text-zinc-300 w-6 h-4">
        {code.toUpperCase().slice(0, 2)}
      </span>
    );
  }
  return <Flag className={className} />;
}
