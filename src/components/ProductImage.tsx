import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * <img> with a graceful fallback when the source fails to load, instead
 * of the browser's default broken-image icon. Product images currently
 * come from an external placeholder host (picsum.photos) — if that's
 * ever slow or unreachable, this keeps the layout intact.
 */
export function ProductImage({
  src,
  alt,
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className={cn("flex items-center justify-center bg-cream-deep text-olive-soft/60", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} {...props} />;
}
