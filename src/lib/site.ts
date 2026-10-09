/** Public contact + optional legal identity, shown in the footer and legal pages. */
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || "hello@tsiskariart.ge"

/**
 * Optional one-line seller identity, e.g. "ინდ. მეწარმე სახელი გვარი, ს/კ 000000000, თბილისი".
 * Leave VITE_BUSINESS_LINE unset to show only the email.
 */
export const BUSINESS_LINE: string = import.meta.env.VITE_BUSINESS_LINE || ""
