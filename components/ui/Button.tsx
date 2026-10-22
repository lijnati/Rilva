import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "butter" | "ink" | "outline" | "sheet" | "ghost";

interface Common {
  variant?: Variant;
  size?: "md" | "sm";
  /** Trailing glyph: → in-page/primary, ↗ external/secondary (pixel-meadow convention). */
  arrow?: "→" | "↗" | "↓";
  className?: string;
  children: React.ReactNode;
}

function classes(variant: Variant, size: "md" | "sm", className?: string) {
  return cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", className);
}

function Arrow({ arrow }: { arrow?: Common["arrow"] }) {
  if (!arrow) return null;
  return (
    <span className={arrow === "↗" ? "i i-ne" : "i"} aria-hidden="true">
      {arrow}
    </span>
  );
}

export function Button({
  variant = "ink",
  size = "md",
  arrow,
  className,
  children,
  ...rest
}: Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button type="button" className={classes(variant, size, className)} {...rest}>
      {children}
      <Arrow arrow={arrow} />
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "ink",
  size = "md",
  arrow,
  className,
  children,
  external,
}: Common & { href: string; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes(variant, size, className)}>
        {children}
        <Arrow arrow={arrow ?? "↗"} />
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
      <Arrow arrow={arrow} />
    </Link>
  );
}
