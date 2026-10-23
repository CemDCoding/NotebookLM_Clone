/** Shown while the answer is being prepared and no token has arrived yet. */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2" role="status" aria-label="Antwort wird erstellt">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden="true"
          style={{ animationDelay: `${delay}ms` }}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
