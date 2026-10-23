import type { Components } from 'react-markdown';
import { CitationMarker } from './citation-marker';

/**
 * Element styles for answers; the design tokens replace a typography plugin. Each element takes
 * only the props it needs, so neither react-markdown's `node` nor unexpected attributes reach
 * the DOM.
 */
export const markdownComponents: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="font-semibold">{children}</h5>,
  ul: ({ children }) => (
    <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 pl-4 text-muted-foreground">{children}</blockquote>
  ),
  // Links in answers may come from uploaded documents, so they never get the opener or referrer.
  // react-markdown has already removed unsafe protocols such as `javascript:` from `href`.
  a: ({ children, href, title }) => (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary underline underline-offset-4 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-sm [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="border-border" />,
  span: CitationMarker,
};
