/**
 * ----------------------------------------------------------------------------------
 * DeletePredictor (modal)
 * ----------------------------------------------------------------------------------
 * - Simple confirm dialog for destructive actions.
 * - Controlled by `open` boolean; when false, returns null (renders nothing).
 * - Renders as a centered dialog with a dark backdrop using fixed positioning.
 */

interface DeletePredictorProps {
  open: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeletePredictor({
  open,
  name,
  onCancel,
  onConfirm,
}: DeletePredictorProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-base font-semibold">Delete “{name}”?</h3>
        <p className="mt-1 text-sm text-gray-600">
          This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
