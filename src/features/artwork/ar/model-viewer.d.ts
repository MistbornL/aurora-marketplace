// JSX typing for Google's <model-viewer> custom element.
import type { DetailedHTMLProps, HTMLAttributes } from "react"

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string
  poster?: string
  alt?: string
  ar?: boolean | ""
  "ar-modes"?: string
  "ar-placement"?: "floor" | "wall"
  "ar-scale"?: "auto" | "fixed"
  "camera-controls"?: boolean | ""
  "disable-zoom"?: boolean | ""
  "touch-action"?: string
  "camera-orbit"?: string
  "min-camera-orbit"?: string
  "max-camera-orbit"?: string
  "shadow-intensity"?: string
  "shadow-softness"?: string
  exposure?: string
  "environment-image"?: string
  "interaction-prompt"?: string
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes
    }
  }
}

/** The bits of the element API we use. */
export type ModelViewerElement = HTMLElement & {
  canActivateAR: boolean
  activateAR: () => Promise<void>
}
