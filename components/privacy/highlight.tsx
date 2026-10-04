import { Fragment } from "react";

const PH = /(\[[A-Z]+_\d+\])/g;

/** Render text with [TYPE_n] placeholders as chips. */
export function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(PH);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[A-Z]+_\d+\]$/.test(p) ? (
          <span key={i} className="chip-ph">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Render text with the given original values underlined (the bits that will be replaced). */
export function WithOriginals({ text, values }: { text: string; values: string[] }) {
  const uniq = [...new Set(values.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!uniq.length) return <>{text}</>;
  const re = new RegExp(`(${uniq.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((p, i) =>
        uniq.includes(p) ? (
          <mark key={i} className="chip-orig">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
