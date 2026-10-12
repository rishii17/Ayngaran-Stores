export const initialCalculator = () => ({
  display: "0",
  left: null,
  op: "",
  fresh: false,
  history: [],
  count: 0,
});
export function calculatorKey(key) {
  return (
    {
      "*": "×",
      "/": "÷",
      "-": "−",
      Enter: "=",
      Backspace: "⌫",
      Delete: "C",
      c: "C",
      C: "C",
    }[key] || key
  );
}
export function calculate(state, input) {
  const key = calculatorKey(input);
  if (key === "C") return initialCalculator();
  const s = { ...state };
  if (key === "⌫") {
    if (s.fresh || s.display === "Error") return s;
    s.display = s.display.length > 1 ? s.display.slice(0, -1) : "0";
    return s;
  }
  if (/^[0-9.]$/.test(key)) {
    if (s.display === "Error") return calculate(initialCalculator(), key);
    if (s.fresh) {
      s.display = "0";
      s.fresh = false;
      if (!s.op) s.count = 0;
    }
    if (key === "." && s.display.includes(".")) return s;
    if (s.display.length >= 15) return s;
    s.display = s.display === "0" && key !== "." ? key : s.display + key;
    return s;
  }
  if (!["+", "−", "×", "÷", "="].includes(key) || s.display === "Error")
    return s;
  if (s.fresh) {
    if (key !== "=") {
      s.op = key;
      s.left = Number(s.display);
    }
    return s;
  }
  const right = Number(s.display);
  s.count += 1;
  if (s.left !== null && s.op) {
    const value =
      s.op === "+"
        ? s.left + right
        : s.op === "−"
          ? s.left - right
          : s.op === "×"
            ? s.left * right
            : right === 0
              ? NaN
              : s.left / right;
    s.display = Number.isFinite(value)
      ? String(Math.round((value + Number.EPSILON) * 100) / 100)
      : "Error";
    s.history = [
      ...s.history,
      `${s.left} ${s.op} ${right} = ${s.display}`,
    ].slice(-100);
  }
  s.left = key === "=" ? null : Number(s.display);
  s.op = key === "=" ? "" : key;
  s.fresh = true;
  return s;
}
