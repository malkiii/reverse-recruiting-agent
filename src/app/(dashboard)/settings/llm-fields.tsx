"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/ui";
import type { LlmProvider } from "@/lib/schema";

/** The provider select and a model combobox suggesting that provider's models. Any model can still be typed. */
export function LlmFields({
  providerNames,
  suggestedModels,
  provider: savedProvider,
  model: savedModel,
}: {
  // Passed in rather than imported, so the LLM SDKs stay out of the browser bundle.
  providerNames: Record<LlmProvider, string>;
  suggestedModels: Record<LlmProvider, string[]>;
  provider?: LlmProvider;
  model?: string;
}) {
  const [provider, setProvider] = useState<LlmProvider>(savedProvider ?? "claude");
  const [model, setModel] = useState(savedModel ?? suggestedModels[provider][0]);

  function chooseProvider(next: LlmProvider) {
    setProvider(next);
    // Another provider's model would fail, so switch to the new provider's first suggestion.
    if (!suggestedModels[next].includes(model)) setModel(suggestedModels[next][0]);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Provider</span>
        <select
          name="provider"
          value={provider}
          onChange={(event) => chooseProvider(event.target.value as LlmProvider)}
          required
          className={inputClass}
        >
          {(Object.keys(providerNames) as LlmProvider[]).map((option) => (
            <option key={option} value={option}>
              {providerNames[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Model</span>
        <input
          name="model"
          list={`llm-models-${provider}`}
          value={model}
          onChange={(event) => setModel(event.target.value)}
          autoComplete="off"
          required
          className={inputClass}
        />
        <datalist id={`llm-models-${provider}`}>
          {suggestedModels[provider].map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>
    </div>
  );
}
