import type { ModelInfo } from "@diffgazer/core/schemas/config";

/**
 * The exact id leads a model row's secondary line because it is the string a
 * review pins: the catalog publishes distinct routes under one display name
 * (two OpenRouter entries are both "Nano Banana Pro"), so the name alone cannot
 * identify the model. The context blurb trails it and is the first thing
 * truncation takes; when upstream publishes no display name the two are equal
 * and the id is not repeated.
 */
export function getModelDetail(model: ModelInfo): string {
  const parts = model.id === model.name ? [] : [model.id];
  if (model.description) parts.push(model.description);
  return parts.join(" · ");
}
