import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillVariant = "primary" | "inverse" | "outline";
export type PillSize = "lg" | "md" | "sm";

const variants: Record<PillVariant, string> = {
  primary: "bg-accent text-ink hover:bg-[#2b60f0] active:bg-accent-deep",
  inverse: "bg-ink text-bg hover:bg-[#ececec] active:bg-title",
  outline: "border-2 border-ink text-ink hover:bg-surface-2 active:bg-line",
};

// primary · inverse · outline · disabled — h 56 / 48 / 44
const sizes: Record<PillSize, string> = {
  lg: "h-14 px-6 text-button",
  md: "h-12 px-5 text-[1.25rem]",
  sm: "h-11 px-4 text-[1.0625rem]",
};

type Common = {
  variant?: PillVariant;
  size?: PillSize;
  arrow?: boolean;
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: undefined };
type AsLink = Common & { href: string; disabled?: boolean; onClick?: () => void };

function pillClasses({ variant = "primary", size = "lg", block, className }: Common, disabled?: boolean) {
  return cn(
    "display inline-flex select-none items-center justify-center gap-3 rounded-full transition-colors",
    sizes[size],
    disabled ? "cursor-not-allowed bg-accent-deep text-ink/40" : variants[variant],
    block && "w-full",
    className,
  );
}

function PillContent({ children, arrow }: Pick<Common, "children" | "arrow">) {
  return (
    <>
      <span>{children}</span>
      {arrow && <span aria-hidden="true">→</span>}
    </>
  );
}

export function PillButton(props: AsButton | AsLink) {
  if (props.href !== undefined && !props.disabled) {
    return (
      <Link href={props.href} className={pillClasses(props)} onClick={props.onClick}>
        <PillContent arrow={props.arrow}>{props.children}</PillContent>
      </Link>
    );
  }
  const { variant, size, arrow, block, children, className, href: _href, ...rest } = props as AsButton;
  void _href;
  return (
    <button
      type="button"
      {...rest}
      className={pillClasses({ variant, size, block, className, children }, props.disabled)}
    >
      <PillContent arrow={arrow}>{children}</PillContent>
    </button>
  );
}
