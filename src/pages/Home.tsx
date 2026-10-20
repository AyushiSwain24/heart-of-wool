import { Link } from "react-router-dom";
import { ProductBrowser } from "@/components/ProductBrowser";
import { BundleSection } from "@/components/BundleSection";
import { HowItWorks } from "@/components/HowItWorks";
import { SHOP_NAME, SHOP_TAGLINE } from "@/data/shop";

export function Home() {
  return (
    <>
      {/* Hero comes first — "Shop Now" should be visible the moment the page
          opens, before any scrolling. Bundles/deals moved below the hero. */}
      <section className="bg-cream px-4 pt-10 pb-2">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-serif text-3xl text-olive sm:text-4xl">{SHOP_NAME}</p>
          <p className="mt-1 text-xs tracking-[0.35em] text-olive-soft uppercase">{SHOP_TAGLINE}</p>
          <h1 className="mt-6 font-serif text-3xl leading-tight text-olive sm:text-5xl">
            Little handmade things, made slowly 🧶
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-olive-soft">
            Crochet dolls, resin charms, crochet charms and keychains — order online, pay by UPI or COD, and track
            your order right here.
          </p>
          <a
            href="#shop"
            className="mt-7 inline-block rounded-full bg-pink px-7 py-3.5 text-xs font-semibold tracking-[0.2em] text-primary-foreground uppercase shadow-soft transition-transform hover:scale-105"
          >
            Shop Now →
          </a>
        </div>
      </section>

      <BundleSection />

      <HowItWorks />

      <ProductBrowser />

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-3xl border border-dashed border-olive/40 bg-card p-7 text-center">
          <h2 className="font-serif text-2xl text-olive">Already ordered?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-olive-soft">
            Check your order status any time with your order number and email or phone.
          </p>
          <Link
            to="/track-order"
            className="mt-5 inline-block rounded-full border border-olive px-6 py-3 text-xs font-semibold tracking-[0.15em] text-olive uppercase transition-colors hover:bg-cream-deep"
          >
            Track your order
          </Link>
        </div>
      </section>
    </>
  );
}
