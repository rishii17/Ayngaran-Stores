"use client";
import { useEffect, useReducer } from "react";
import {
  calculate,
  calculatorKey,
  initialCalculator,
} from "../lib/calculator.mjs";
export default function QuickCalculator() {
  const [state, dispatch] = useReducer(calculate, undefined, initialCalculator);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
        return;
      const key = calculatorKey(event.key);
      if (
        !/^[0-9.]$/.test(key) &&
        !["+", "−", "×", "÷", "=", "⌫", "C"].includes(key)
      )
        return;
      event.preventDefault();
      dispatch(key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div>
      <div className="calculator-history" aria-label="Calculation steps">
        {state.history.length ? (
          state.history.map((step: string, i: number) => (
            <div key={i}>
              {i + 1}. {step}
            </div>
          ))
        ) : (
          <p>Your calculation steps appear here.</p>
        )}
      </div>
      <p className="muted">
        {state.count} numbers in this calculation · {state.history.length} saved
        steps (last 100)
      </p>
      <div className="calc-display" aria-live="polite">
        <small>
          {state.left !== null ? `${state.left} ${state.op}` : "Result / entry"}
        </small>
        <strong>{state.display}</strong>
      </div>
      <div className="calc-grid">
        {[
          "C",
          "⌫",
          "÷",
          "×",
          "7",
          "8",
          "9",
          "−",
          "4",
          "5",
          "6",
          "+",
          "1",
          "2",
          "3",
          "=",
          "0",
          ".",
        ].map((key) => (
          <button
            type="button"
            data-calculator-key={key}
            className={key === "=" ? "equals" : ""}
            key={key}
            onClick={() => dispatch(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <p className="muted">
        Calculates left to right, rounded to 2 decimals. Keyboard: + − * /,
        Enter =, Backspace, C to clear. Escape closes.
      </p>
    </div>
  );
}
