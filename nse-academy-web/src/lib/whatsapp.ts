/** The number people reach the NSE Academy team on. */
export const SITE_MANAGER_PHONE = "254747206415";

export function whatsappLink(message: string): string {
  return `https://wa.me/${SITE_MANAGER_PHONE}?text=${encodeURIComponent(message)}`;
}
