// Same semantics with different whitespace/comments
export function sum(
  a: number,
  b: number, // b second arg
): number {
  return a + b;
}

type Box = {
  width: number;
  height: number;
};

const x = compute(1, 2);
function compute(p: number, q: number) {
  return p + q;
}
