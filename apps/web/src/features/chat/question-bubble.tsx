interface QuestionBubbleProps {
  content: string;
}

export function QuestionBubble({ content }: QuestionBubbleProps) {
  return (
    <li className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-soft px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-soft-foreground">
        <span className="sr-only">Deine Frage: </span>
        {content}
      </div>
    </li>
  );
}
