export const SYSTEM_PROMPT = `You are an expert crochet designer and teacher. The user will send a photo of an object from their surroundings. Design an original crochet pattern that recreates that object (or a faithful crocheted interpretation of it, e.g. an amigurumi version of a figure, a coaster version of a flat object, a cozy for a mug).

Guidance:
- Identify the object and choose a sensible crochet approach and finished size.
- Match yarn colors to the colors actually visible in the photo; give each one a descriptive name and a hex code sampled from the image.
- Recommend a specific yarn weight (using the Craft Yarn Council 0–7 system), fiber, and realistic yardage per color.
- Recommend a hook size in both mm and US letter/number, consistent with the yarn weight and desired fabric (amigurumi uses a smaller hook than the label suggests for tight fabric).
- List every other material and notion (stuffing, safety eyes, stitch markers, tapestry needle, etc.).
- Use standard US crochet terminology and list every abbreviation you use.
- Instructions must be complete and followable by an advanced beginner: every round/row with its stitch count in parentheses, color changes, assembly, and finishing. Don't skip rounds with "repeat until done" unless you state exactly how many times.
- If the photo shows something that can't reasonably be crocheted, pick the closest reasonable crocheted interpretation and explain it in the summary.
- If the image contains no identifiable object, set "identified" to false and explain why in "summary"; the other fields may then be minimal.`;

// JSON Schema for structured output. Every object sets additionalProperties:false
// and lists all properties in required, as structured outputs require.
export const PATTERN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "identified", "item_name", "summary", "difficulty", "finished_size", "estimated_time",
    "yarn", "hook", "other_materials", "gauge", "abbreviations", "sections", "tips",
  ],
  properties: {
    identified: { type: "boolean" },
    item_name: { type: "string" },
    summary: { type: "string" },
    difficulty: { type: "string", enum: ["Beginner", "Easy", "Intermediate", "Experienced"] },
    finished_size: { type: "string" },
    estimated_time: { type: "string" },
    yarn: {
      type: "object",
      additionalProperties: false,
      required: ["weight", "fiber", "why", "colors"],
      properties: {
        weight: { type: "string" },
        fiber: { type: "string" },
        why: { type: "string" },
        colors: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "hex", "used_for", "yardage"],
            properties: {
              name: { type: "string" },
              hex: { type: "string" },
              used_for: { type: "string" },
              yardage: { type: "string" },
            },
          },
        },
      },
    },
    hook: {
      type: "object",
      additionalProperties: false,
      required: ["size_mm", "size_us", "why"],
      properties: {
        size_mm: { type: "string" },
        size_us: { type: "string" },
        why: { type: "string" },
      },
    },
    other_materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "note"],
        properties: { item: { type: "string" }, note: { type: "string" } },
      },
    },
    gauge: { type: "string" },
    abbreviations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["abbr", "meaning"],
        properties: { abbr: { type: "string" }, meaning: { type: "string" } },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "color", "steps"],
        properties: {
          title: { type: "string" },
          color: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "instruction", "stitch_count"],
              properties: {
                label: { type: "string" },
                instruction: { type: "string" },
                stitch_count: { type: "string" },
              },
            },
          },
        },
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
};

// An error whose message is safe to show to the user.
export class PatternError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
