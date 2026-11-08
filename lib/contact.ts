// Owner contact details shown in the app. Set these in .env.local / Vercel env vars
// (NEXT_PUBLIC_* values are built into the page, so they are visible to every visitor).
export const CONTACT = {
  name: process.env.NEXT_PUBLIC_CONTACT_NAME ?? "",
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/[^\d+]/g, ""),
  zoom: process.env.NEXT_PUBLIC_ZOOM_LINK ?? "",
};

export const hasContact = Boolean(CONTACT.whatsapp || CONTACT.zoom);

export function whatsappLink(text = "Hi! I found you through Live Presentation Studio.") {
  const digits = CONTACT.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
