import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router doesn't reset scroll position on navigation by default —
 * without this, clicking into a product from partway down the catalog
 * (or any other in-app link) opens the new page still scrolled to wherever
 * you were, instead of at the top. This resets scroll to (0, 0) on every
 * path change so every page you navigate to opens at the top, the way
 * users expect.
 *
 * Renders nothing — mounted once in App.tsx alongside the router.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
