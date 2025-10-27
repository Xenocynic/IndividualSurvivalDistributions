/**
 * ---------------------------------------------------------------------------------- 
 * CardShell
 * ----------------------------------------------------------------------------------
 * - A shared “shell” for cards (PredictorCard / DatasetCard).
 * - Handles layout (title, optional description, sticky-to-bottom footer),
 *   selection ring, and an action toolbar that sits in-flow (no overlap).
 *
 * React/TS notes:
 * - Props use ReactNode so callers can pass strings or JSX.
 * - children renders the action buttons (Edit / Delete / View) when visible
 *   based on `actionVisibility`.
 * - onActionAreaClick stops propagation so clicking actions doesn't toggle selection.
 *
 * Styling updates:
 * - Unified neutral palette (matches Create/Upload pages).
 * - Removed absolute-positioned action area; actions now live in a dedicated row.
 * - No overlap with title (title gets its own space, actions come later).
 */

import type {
  PropsWithChildren,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  MouseEvent,
} from "react";

type CardShellProps = {
  title: ReactNode;
  description?: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onActionAreaClick?: (e: MouseEvent) => void;
  /** when to reveal the action buttons (children) */
  actionVisibility?: "hover" | "selected" | "always";
};

const clamp3: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export default function CardShell({
  title,
  description,
  footerLeft,
  footerRight,
  selected = false,
  onSelect,
  onDoubleClick,
  onActionAreaClick,
  actionVisibility = "hover",
  children,
}: PropsWithChildren<CardShellProps>) {
  const actionsVisibilityClass =
    actionVisibility === "always"
      ? "opacity-100"
      : actionVisibility === "selected"
      ? selected
        ? "opacity-100"
        : "opacity-0 pointer-events-none"
      : // hover (default)
        "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={`group relative cursor-pointer rounded-md border border-neutral-200 bg-white p-4 shadow-card transition
        ${selected ? "ring-2 ring-neutral-900" : "hover:ring-1 hover:ring-neutral-400"}`}
    >
      <div className="flex min-h-[168px] flex-col gap-3">
        {/* Actions toolbar (now above the title, in-flow) */}
        {children ? (
          <div
            className={`-mt-1 mb-1 flex justify-end gap-2 ${actionsVisibilityClass}`}
            onClick={(e) => {
              onActionAreaClick?.(e);
              e.stopPropagation(); // don’t toggle selection when clicking actions
            }}
          >
            {children}
          </div>
        ) : null}

        {/* Title (gets its own space; no overlay) */}
        <h3 className="text-sm font-medium leading-snug overflow-hidden text-ellipsis whitespace-nowrap">
          {title}
        </h3>

        {/* Description */}
        {description ? (
          <div
            className="text-sm leading-5 text-neutral-600 break-words hyphens-auto"
            style={clamp3}
          >
            {description}
          </div>
        ) : null}

        {/* Footer pinned to bottom */}
        {(footerLeft || footerRight) && (
          <div className="mt-auto flex items-center justify-between text-xs">
            <div className="text-neutral-500">{footerLeft}</div>
            <div className="flex items-center gap-2">{footerRight}</div>
          </div>
        )}
      </div>
    </div>
  );
}
