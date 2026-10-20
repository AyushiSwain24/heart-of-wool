import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small inline "copy to clipboard" button. Used next to things a customer
 * needs to retype elsewhere (UPI id, order number) — retyping by hand is
 * exactly the kind of friction that makes a manual-payment flow feel
 * sketchy, so making it copyable in one tap matters for trust, not just
 * convenience.
 */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can fail (older browsers, non-secure context) — the
      // value is still visible as text, so this isn't a dead end.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors",
        copied ? "bg-pink text-primary-foreground" : "bg-cream-deep text-olive hover:bg-muted",
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}
