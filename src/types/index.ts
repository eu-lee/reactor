export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  text: string;
  bgColor?: string;
  textColor?: string;
  hasBorder?: boolean;
  isRounded?: boolean;
}

export interface DetectionResponse {
  boxes: BoundingBox[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LayoutChange {
  elementTag: string;
  elementText: string;
  elementClasses?: string;
  deltaX: number;
  deltaY: number;
  direction: string;
  siblingsBefore?: { index: number; tag: string; text: string; y: number; x: number }[];
  siblingsAfter?: { index: number; tag: string; text: string; y: number; x: number }[];
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export type AppStage = "upload" | "detect" | "edit" | "generate" | "iterate";

export const UI_LABELS = [
  "Text",
  "Image",
  "Icon",
  "Heading",
  "Text Button",
  "Text Input",
  "Card",
  "Paragraph",
  "Toggle",
  "Checkbox",
  "Link",
  "Dropdown",
  "Radio Button",
  "Slider",
  "Navigation",
  "Container",
  "Element",
] as const;

export type UILabel = (typeof UI_LABELS)[number];
