import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function inlineStyles(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-xs">$1</code>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');
}

export function formatMarkdown(text: string): string {
  if (!text) return "";
  
  const lines = text.split("\n");
  let html = "";
  let listType: "ul" | "ol" | null = null;
  let inParagraph = false;
  let paragraphText = "";

  const closeList = () => {
    if (listType === "ul") {
      html += "</ul>";
    } else if (listType === "ol") {
      html += "</ol>";
    }
    listType = null;
  };

  const closeParagraph = () => {
    if (inParagraph) {
      if (paragraphText.trim()) {
        html += `<p class="mb-4">${inlineStyles(paragraphText.trim())}</p>`;
      }
      inParagraph = false;
      paragraphText = "";
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      closeParagraph();
      continue;
    }

    // Headings
    if (trimmed.startsWith("#")) {
      closeList();
      closeParagraph();
      const match = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const textContent = inlineStyles(match[2]);
        if (level === 1) {
          html += `<h1 class="text-2xl font-bold mt-8 mb-4">${textContent}</h1>`;
        } else if (level === 2) {
          html += `<h2 class="text-xl font-bold mt-6 mb-3">${textContent}</h2>`;
        } else {
          html += `<h3 class="text-lg font-bold mt-4 mb-2">${textContent}</h3>`;
        }
      } else {
        html += `<p class="mb-4">${inlineStyles(trimmed)}</p>`;
      }
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      closeList();
      closeParagraph();
      const quoteText = inlineStyles(trimmed.slice(1).trim());
      html += `<blockquote class="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic my-4">${quoteText}</blockquote>`;
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[\-\*]\s+(.*)$/);
    if (ulMatch) {
      closeParagraph();
      if (listType !== "ul") {
        closeList();
        html += '<ul class="list-disc pl-5 mb-4 space-y-1">';
        listType = "ul";
      }
      html += `<li>${inlineStyles(ulMatch[1])}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      closeParagraph();
      if (listType !== "ol") {
        closeList();
        html += '<ol class="list-decimal pl-5 mb-4 space-y-1">';
        listType = "ol";
      }
      html += `<li>${inlineStyles(olMatch[2])}</li>`;
      continue;
    }

    // Normal paragraph text (can span multiple lines)
    if (listType) {
      closeList();
    }
    
    inParagraph = true;
    if (paragraphText) {
      paragraphText += " " + trimmed;
    } else {
      paragraphText = trimmed;
    }
  }

  closeList();
  closeParagraph();

  return html;
}
