import React from "react";
import { AlertTriangle, Wrench, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";

/**
 * Parses inline formatting like **bold**, *italic*, and `code` safely into React nodes.
 */
function parseInline(text) {
  if (!text) return null;

  // Split by bold (**text**)
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className="font-semibold text-slate-100">
          {inner}
        </strong>
      );
    }

    // Split by code (`code`)
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cPart, j) => {
      if (cPart.startsWith("`") && cPart.endsWith("`") && cPart.length >= 2) {
        return (
          <code
            key={`${i}-${j}`}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[11px] border border-slate-700/60"
          >
            {cPart.slice(1, -1)}
          </code>
        );
      }

      // Split by italic (*text*)
      const italicParts = cPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, k) => {
        if (iPart.startsWith("*") && iPart.endsWith("*") && iPart.length >= 2) {
          return (
            <em key={`${i}-${j}-${k}`} className="text-slate-300 italic">
              {iPart.slice(1, -1)}
            </em>
          );
        }
        return iPart;
      });
    });
  });
}

/**
 * FormattedMessage parses assistant messages into clean, readable structured UI blocks.
 * Avoids any raw markdown asterisks and presents comfortable typography and spacing.
 */
export default function FormattedMessage({ content }) {
  if (!content) return null;

  // Split content by paragraphs or lines
  const lines = content.split("\n");
  const blocks = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({
        type: "list",
        items: [...currentList],
      });
      currentList = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx].trim();
    if (!rawLine) {
      flushList();
      continue;
    }

    // Check if line is a bullet item
    const isBullet =
      rawLine.startsWith("- ") ||
      rawLine.startsWith("• ") ||
      rawLine.startsWith("* ") ||
      /^\d+\.\s/.test(rawLine);

    if (isBullet) {
      const cleanItem = rawLine.replace(/^[-•*]\s+|\d+\.\s+/, "");
      currentList.push(cleanItem);
    } else {
      flushList();

      // Check if line is a section heading
      const cleanHeader = rawLine.replace(/^[#*]+\s*|[:*]+$/g, "").trim();
      const lower = rawLine.toLowerCase();

      if (
        rawLine.startsWith("#") ||
        (rawLine.startsWith("**") && rawLine.endsWith("**") && rawLine.length < 50) ||
        lower.startsWith("plausible cause") ||
        lower.startsWith("safety alert") ||
        lower.startsWith("historical experience") ||
        lower.startsWith("question for technician")
      ) {
        let sectionType = "general";
        if (lower.includes("safety")) sectionType = "safety";
        else if (lower.includes("question") || lower.includes("ask")) sectionType = "question";
        else if (lower.includes("historical") || lower.includes("precedent")) sectionType = "history";

        blocks.push({
          type: "heading",
          text: cleanHeader,
          sectionType,
        });
      } else {
        blocks.push({
          type: "paragraph",
          text: rawLine,
        });
      }
    }
  }
  flushList();

  return (
    <div className="space-y-3 text-slate-200 text-[13.5px] leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          if (block.sectionType === "safety") {
            return (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mt-2 mb-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{block.text}</span>
              </div>
            );
          }
          if (block.sectionType === "question") {
            return (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400 mt-3 mb-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{block.text}</span>
              </div>
            );
          }
          if (block.sectionType === "history") {
            return (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 mt-3 mb-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{block.text}</span>
              </div>
            );
          }
          return (
            <h4
              key={idx}
              className="text-xs font-bold uppercase tracking-wider text-emerald-400 mt-3 mb-1"
            >
              {block.text}
            </h4>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={idx} className="space-y-2 my-2">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5 text-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-2"></span>
                  <div className="flex-1 leading-normal">{parseInline(item)}</div>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="text-slate-200 leading-relaxed">
            {parseInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
