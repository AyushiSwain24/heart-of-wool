import { ProductBrowser } from "@/components/ProductBrowser";
import { BundleSection } from "@/components/BundleSection";

export function Products() {
  return (
    <div>
      <BundleSection />
      <ProductBrowser heading="All Products" subheading="Every Heart of Wool piece, in one place" />
    </div>
  );
}
