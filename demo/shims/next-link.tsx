import type { AnchorHTMLAttributes, ReactNode } from "react";
import { routeToHash } from "../routes";

/** Ersatz für next/link in der Artifact-Demo (Hash-Routing). */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  const target = routeToHash(href);
  return (
    <a
      href={target}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (target.startsWith("#") && document.getElementById(target.slice(1))) {
          e.preventDefault();
          document.getElementById(target.slice(1))!.scrollIntoView({ behavior: "smooth" });
        } else if (target.startsWith("#")) {
          window.scrollTo(0, 0);
        }
      }}
    >
      {children}
    </a>
  );
}
