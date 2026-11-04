import { useSyncExternalStore } from "react";
import { currentPath, navigate } from "../routes";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** Ersatz für next/navigation in der Artifact-Demo. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}

export function useRouter() {
  return {
    push: (p: string) => navigate(p),
    replace: (p: string) => navigate(p),
    refresh: () => {},
    back: () => history.back(),
  };
}
