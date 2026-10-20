import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, ShoppingBag, X } from "lucide-react";
import { SHOP_NAME } from "@/data/shop";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/products", label: "Shop" },
  { to: "/track-order", label: "Track Order" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-9 w-auto" />
          <span className="font-serif text-xl text-olive">{SHOP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-7 sm:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "text-xs font-semibold tracking-widest text-olive-soft uppercase transition-colors hover:text-olive",
                  isActive && "text-olive",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-cream-deep text-olive"
            aria-label="View cart"
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink text-[10px] font-bold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-deep text-olive sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-border bg-cream px-4 py-3 sm:hidden">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-2 py-2.5 text-xs font-semibold tracking-widest text-olive-soft uppercase hover:bg-cream-deep hover:text-olive"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
