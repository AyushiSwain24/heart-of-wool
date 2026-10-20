import { Link } from "react-router-dom";
import { CONTACT_EMAIL, CONTACT_PHONE, INSTAGRAM_HANDLE, INSTAGRAM_URL, SHOP_NAME, SHOP_TAGLINE } from "@/data/shop";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-cream-deep/60">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-serif text-lg text-olive">{SHOP_NAME}</p>
            <p className="mt-1 text-xs tracking-widest text-olive-soft uppercase">{SHOP_TAGLINE}</p>
            <p className="mt-3 max-w-xs text-sm text-olive-soft">
              Handmade crochet dolls, resin charms, crochet charms and keychains — made slowly, by hand.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-olive uppercase">Shop</p>
            <ul className="mt-3 space-y-2 text-sm text-olive-soft">
              <li>
                <Link to="/products" className="hover:text-olive">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/track-order" className="hover:text-olive">
                  Track Order
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-olive">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-olive uppercase">Say Hi</p>
            <ul className="mt-3 space-y-2 text-sm text-olive-soft">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-olive">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={`tel:${CONTACT_PHONE}`} className="hover:text-olive">
                  {CONTACT_PHONE}
                </a>
              </li>
              <li>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-olive">
                  @{INSTAGRAM_HANDLE}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-olive-soft/70">
          Every order is confirmed and packed by hand — no bots, no big warehouse. Questions any time, we usually
          reply within a day.
        </p>
        <p className="mt-2 text-center text-[11px] text-olive-soft/70">
          © {new Date().getFullYear()} {SHOP_NAME}. Made with care.
        </p>
      </div>
    </footer>
  );
}
