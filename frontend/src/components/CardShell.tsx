/**
 * ---------------------------------------------------------------------------------- 
 * CardShell
 * ----------------------------------------------------------------------------------
 * - A shared “shell” for cards (PredictorCard / DatasetCard).
 * - Handles layout (title, optional description, sticky-to-bottom footer),
 *   selection ring, and an absolute-positioned action area in the top-right.
 *
 * React/TS notes:
 * - Props use ReactNode so callers can pass strings or JSX.
 * - children renders the action buttons (Edit / Delete / View) only when the card is selected.
 * - onActionAreaClick is used to stopPropagation so clicking actions doesn't toggle selection.
 * 
 * 
 * TO DO:
 * - Replace Edit / Delete / View text with icons, potentially?
 * - potentailly also allow users to edit the name of the dataset / predictor on top rather 
 *   than sending them to the entire Edit view (?)
 * - 
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
  onActionAreaClick,
  actionVisibility = "hover",
  children,
}: PropsWithChildren<CardShellProps>) {
  const actionClass =
    actionVisibility === "always"
      ? ""
      : actionVisibility === "selected"
      ? selected
        ? ""
        : "hidden"
      : // hover (default)
        "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={`group relative cursor-pointer rounded-xl border border-black/10 bg-white p-4 shadow-card transition
        ${selected ? "ring-2 ring-black" : "hover:ring-1 hover:ring-black/30"}`}
    >
      <div className="flex min-h-[168px] flex-col gap-3">
        {/* Title */}
        <h3 className="pr-20 text-sm font-medium leading-snug break-words hyphens-auto">
          {title}
        </h3>

        {/* Description */}
        {description ? (
          <div
            className="text-sm leading-5 text-gray-600 break-words hyphens-auto"
            style={clamp3}
          >
            {description}
          </div>
        ) : null}

        {/* Footer pinned to bottom */}
        {(footerLeft || footerRight) && (
          <div className="mt-auto flex items-center justify-between text-xs">
            <div className="text-gray-500">{footerLeft}</div>
            <div className="flex items-center gap-2">{footerRight}</div>
          </div>
        )}
      </div>

      {/* Action area (absolute, top-right) */}
      {children ? (
        <div
          className={`absolute right-3 top-3 flex gap-2 ${actionClass}`}
          onClick={onActionAreaClick as any}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
