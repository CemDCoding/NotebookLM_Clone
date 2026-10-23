import { ArrowLeft, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { RouteStatus } from '@/app/_components/route-status';
import { Button } from '@/components/ui/button';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

// Missing and foreign notebooks look the same, so the text does not say which one it was.
export default function NotebookNotFound() {
  return (
    <RouteStatus
      icon={FileQuestion}
      title="Notebook nicht gefunden"
      description="Dieses Notebook gibt es nicht oder nicht mehr. Wähle ein anderes aus deiner Übersicht."
    >
      <Button asChild variant="outline">
        <Link href={NOTEBOOKS_PATH}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Zu deinen Notebooks
        </Link>
      </Button>
    </RouteStatus>
  );
}
