import { CONTACT, hasContact, whatsappLink } from "@/lib/contact";

/** The app owner's WhatsApp + Zoom, shown so anyone can get in touch. */
export default function ContactBar() {
  if (!hasContact) return null;
  return (
    <div className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="font-semibold">Contact {CONTACT.name || "us"}</p>
        {CONTACT.whatsapp && (
          <p className="text-sm text-slate-300">
            WhatsApp: <a href={whatsappLink()} target="_blank" rel="noreferrer" className="font-medium text-[#25D366] hover:underline">{CONTACT.whatsapp}</a>
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {CONTACT.whatsapp && (
          <a href={whatsappLink()} target="_blank" rel="noreferrer"
            className="rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-slate-950 transition hover:brightness-110">
            ✆ Chat on WhatsApp
          </a>
        )}
        {CONTACT.zoom && (
          <a href={CONTACT.zoom} target="_blank" rel="noreferrer"
            className="rounded-xl bg-[#2D8CFF] px-4 py-2.5 font-semibold text-white transition hover:brightness-110">
            Join my Zoom
          </a>
        )}
      </div>
    </div>
  );
}

/** Floating WhatsApp button, bottom-right on every page. */
export function WhatsAppFloat() {
  if (!CONTACT.whatsapp) return null;
  return (
    <a href={whatsappLink()} target="_blank" rel="noreferrer" aria-label={`Chat on WhatsApp ${CONTACT.whatsapp}`}
      title={`WhatsApp ${CONTACT.whatsapp}`}
      className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_30px_-4px_rgba(37,211,102,0.6)] transition hover:scale-105 print:hidden">
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm5.8 14.1c-.25.69-1.44 1.32-2 1.38-.51.06-1.15.08-1.86-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.9-4.27-5.05-4.47-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.05 1.13 1.01 2.09 1.32 2.38 1.47.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.35.07.12.07.71-.18 1.4Z" />
      </svg>
    </a>
  );
}
