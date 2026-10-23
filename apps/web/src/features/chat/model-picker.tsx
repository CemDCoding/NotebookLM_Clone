'use client';

import type { Model } from '@notebooklm/shared';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModelPickerProps {
  /** `undefined` while the list is loading or could not be loaded. */
  models: readonly Model[] | undefined;
  value: string | undefined;
  onValueChange: (modelId: string) => void;
  disabled?: boolean;
}

function ModelLabel({ model }: { model: Model }) {
  return (
    <>
      {model.label}
      {model.isLocal && (
        <Badge variant="outline" className="text-muted-foreground">
          Lokal
        </Badge>
      )}
    </>
  );
}

/** Chooses the model for the next answer from the models the API allows. */
export function ModelPicker({ models, value, onValueChange, disabled }: ModelPickerProps) {
  const selected = models?.find((model) => model.id === value);

  return (
    <Select
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled || models === undefined}
    >
      <SelectTrigger size="sm" aria-label="Modell" className="max-w-64">
        {/* Rendered explicitly so the trigger shows the label before the list was ever opened. */}
        <SelectValue placeholder="Modell">
          {selected && <ModelLabel model={selected} />}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" side="top" align="start">
        {models?.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <ModelLabel model={model} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
