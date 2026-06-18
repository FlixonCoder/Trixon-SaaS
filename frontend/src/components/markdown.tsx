import React from "react";

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  if (!content) return null;

  // Split content by code blocks first to protect code from formatting rules
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 prose prose-sm max-w-none text-obsidian">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // It's a code block
          const lines = part.split("\n");
          const code = lines.slice(1, -1).join("\n");
          return (
            <pre key={index} className="bg-obsidian text-[#e4e4e7] text-xs px-4 py-3 rounded-xl overflow-x-auto font-mono my-2 border border-zinc-800">
              {code}
            </pre>
          );
        }

        // Parse regular text block
        const lines = part.split("\n");
        let inList = false;
        let listItems: string[] = [];
        let inTable = false;
        let tableRows: string[] = [];
        const renderedElements: React.ReactNode[] = [];

        const flushList = (key: string) => {
          if (listItems.length > 0) {
            renderedElements.push(
              <ul key={`list-${key}`} className="list-disc pl-5 space-y-1 my-2">
                {listItems.map((item, idx) => (
                  <li key={idx} className="text-xs md:text-sm text-[#5a5458] leading-relaxed">
                    {parseInline(item)}
                  </li>
                ))}
              </ul>
            );
            listItems = [];
            inList = false;
          }
        };

        const flushTable = (key: string) => {
          if (tableRows.length > 0) {
            // Filter out empty rows or purely separator rows
            const isSeparator = (rowStr: string) => {
              const cleaned = rowStr.replace(/[|:\s-]/g, "");
              return cleaned.length === 0 && rowStr.includes("-");
            };

            const headerRow = tableRows.find((row, idx) => {
              // Header is usually the first row, if followed by a separator row
              if (idx === 0 && tableRows[1] && isSeparator(tableRows[1])) {
                return true;
              }
              return false;
            });

            // Filter out separator rows
            const contentRows = tableRows.filter(row => !isSeparator(row));

            let headers: string[] = [];
            let rowsToRender = contentRows;

            if (headerRow) {
              headers = parseRowCells(headerRow);
              rowsToRender = contentRows.slice(1);
            }

            renderedElements.push(
              <div key={`table-container-${key}`} className="overflow-x-auto my-4 rounded-xl border border-zinc-200 shadow-sm bg-paper-raised">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-xs md:text-sm">
                  {headers.length > 0 && (
                    <thead className="bg-zinc-50">
                      <tr>
                        {headers.map((cell, idx) => (
                          <th key={idx} className="px-4 py-3 font-semibold text-zinc-900 border-r border-zinc-200 last:border-r-0">
                            {parseInline(cell)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-zinc-200 bg-paper-raised">
                    {rowsToRender.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-zinc-50/50 transition-colors">
                        {parseRowCells(row).map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-3 text-zinc-600 border-r border-zinc-200 last:border-r-0 whitespace-normal break-words">
                            {parseInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

            tableRows = [];
            inTable = false;
          }
        };

        function parseRowCells(rowStr: string) {
          let content = rowStr.trim();
          if (content.startsWith("|")) content = content.slice(1);
          if (content.endsWith("|")) content = content.slice(0, -1);
          return content.split("|").map(cell => cell.trim());
        }

        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();
          const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 3;

          if (isTableRow) {
            flushList(`table-list-${lineIdx}`);
            inTable = true;
            tableRows.push(line);
          } else {
            flushTable(`non-table-${lineIdx}`);

            // Header 3
            if (trimmed.startsWith("### ")) {
              flushList(`h3-${lineIdx}`);
              renderedElements.push(
                <h3 key={`h3-${lineIdx}`} className="text-sm md:text-base font-bold text-obsidian mt-4 mb-2">
                  {parseInline(trimmed.slice(4))}
                </h3>
              );
            }
            // Header 2
            else if (trimmed.startsWith("## ")) {
              flushList(`h2-${lineIdx}`);
              renderedElements.push(
                <h2 key={`h2-${lineIdx}`} className="text-base md:text-lg font-bold text-obsidian mt-5 mb-2 border-b border-paper-sunken pb-1">
                  {parseInline(trimmed.slice(3))}
                </h2>
              );
            }
            // Header 1
            else if (trimmed.startsWith("# ")) {
              flushList(`h1-${lineIdx}`);
              renderedElements.push(
                <h1 key={`h1-${lineIdx}`} className="text-lg md:text-xl font-extrabold text-obsidian mt-6 mb-3">
                  {parseInline(trimmed.slice(2))}
                </h1>
              );
            }
            // List item
            else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
              inList = true;
              const content = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
              listItems.push(content);
            }
            // Empty line
            else if (!trimmed) {
              flushList(`empty-${lineIdx}`);
            }
            // Regular paragraph
            else {
              flushList(`p-${lineIdx}`);
              renderedElements.push(
                <p key={`p-${lineIdx}`} className="text-xs md:text-sm text-[#5a5458] leading-relaxed mb-2">
                  {parseInline(trimmed)}
                </p>
              );
            }
          }
        });

        flushList(`final-${index}`);
        flushTable(`final-${index}`);
        return <React.Fragment key={index}>{renderedElements}</React.Fragment>;
      })}
    </div>
  );
}

// Simple inline parser for bold (**), italic (*), and inline code (`)
function parseInline(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|<br\s*\/?>)/gi;
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.toLowerCase().startsWith("<br")) {
      return <br key={i} />;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-obsidian">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-obsidian">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-[#f4f4f5] text-[#3f3f46] px-1.5 py-0.5 rounded font-mono text-xs border border-zinc-200/50">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

