export const add = (a: number, b: number): number => a + b;

export const subtract = (a: number, b: number): number => a - b;

export const multiply = (a: number, b: number): number => a * b;

export const divide = (a: number, b: number): number => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
};

export function factorial(n: number): number {
  if (n < 0) throw new Error('Factorial is not defined for negative numbers');
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export class Calculator {
  private history: Array<{ operation: string; result: number }> = [];
  private precision: number = 2;

  constructor(precision: number = 2) {
    this.precision = precision;
  }

  add(a: number, b: number): number {
    const result = this.roundToPrecision(a + b);
    this.history.push({ operation: `${a} + ${b}`, result });
    return result;
  }

  subtract(a: number, b: number): number {
    const result = this.roundToPrecision(a - b);
    this.history.push({ operation: `${a} - ${b}`, result });
    return result;
  }

  multiply(a: number, b: number): number {
    const result = this.roundToPrecision(a * b);
    this.history.push({ operation: `${a} * ${b}`, result });
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    const result = this.roundToPrecision(a / b);
    this.history.push({ operation: `${a} / ${b}`, result });
    return result;
  }

  private roundToPrecision(value: number): number {
    return Number(value.toFixed(this.precision));
  }

  getHistory(): Array<{ operation: string; result: number }> {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getLastResult(): number | null {
    return this.history.length > 0 ? this.history[this.history.length - 1].result : null;
  }
}
