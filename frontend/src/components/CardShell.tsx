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
 * - Actions/header row only takes space when visible (selected/hover) or when eyebrow is present.
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
  /** LEFT side of the header row (e.g., UsernameTag). If provided, it sits opposite the actions. */
  eyebrowLeft?: ReactNode;
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
  eyebrowLeft,
  children,
}: PropsWithChildren<CardShellProps>) {
  // Visibility classes that REMOVE layout space when hidden.
  const actionsRowClass =
    actionVisibility === "always"
      ? "flex"
      : actionVisibility === "selected"
      ? selected
        ? "flex"
        : "hidden"
      : // hover
        "hidden group-hover:flex";

  // We render the header row only if there’s either an eyebrowLeft OR visible actions.
  const showHeaderRow =
    Boolean(eyebrowLeft) ||
    actionVisibility === "always" ||
    (actionVisibility === "selected" && selected) ||
    actionVisibility === "hover"; // renders but hidden until hover (no space)

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
      <div className="flex min-h-[168px] flex-col gap-1">
        {/* Header row (username on left, actions on right). 
            Takes NO space when hidden (hover/selected modes). */}
        {showHeaderRow ? (
          <div className="flex items-center justify-between">
            <div className="min-h-[1rem]">{eyebrowLeft}</div>
            {children ? (
              <div
                className={`${actionsRowClass} gap-1`}
                onClick={(e) => {
                  onActionAreaClick?.(e);
                  e.stopPropagation();
                }}
              >
                {children}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Title (separate from actions, never overlapped) */}
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
