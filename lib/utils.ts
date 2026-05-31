import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMarkdown(text: string): string {
  if (!text) return "";
  
  let html = text
    // 1. Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    
    // 2. Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // 3. Lists (Simple implementation)
    .replace(/^\s*[\-\*] (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\s*\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    
    // 4. Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-zinc-300 pl-4 italic my-4">$1</blockquote>')
    
    // 5. Code blocks (inline)
    .replace(/`(.*?)`/g, '<code class="bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-xs">$1</code>')
    
    // 6. Newlines to paragraphs/breaks
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph if it doesn't start with a tag
  if (!html.startsWith('<')) {
    html = '<p class="mb-4">' + html + '</p>';
  } else if (!html.endsWith('>')) {
    html = html + '</p>';
  }
  
  return html;
}
