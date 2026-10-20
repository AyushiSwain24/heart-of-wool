import { CONTACT_EMAIL, CONTACT_PHONE, INSTAGRAM_HANDLE, INSTAGRAM_URL, SHOP_NAME } from "@/data/shop";

export function Contact() {
  return (
    <div className="mx-auto max-w-xl px-5 py-12 text-center">
      <h1 className="font-serif text-4xl text-olive">Say Hi 👋</h1>
      <p className="mt-3 text-sm text-olive-soft">
        Questions about an order, custom requests, or anything else — {SHOP_NAME} would love to hear from you.
      </p>

      <div className="mt-8 space-y-3">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="block rounded-2xl bg-card p-4 text-sm text-olive shadow-soft hover:bg-cream-deep"
        >
          ✉️ {CONTACT_EMAIL}
        </a>
        <a
          href={`tel:${CONTACT_PHONE}`}
          className="block rounded-2xl bg-card p-4 text-sm text-olive shadow-soft hover:bg-cream-deep"
        >
          📞 {CONTACT_PHONE}
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl bg-card p-4 text-sm text-olive shadow-soft hover:bg-cream-deep"
        >
          📷 @{INSTAGRAM_HANDLE} on Instagram
        </a>
      </div>
    </div>
  );
}
