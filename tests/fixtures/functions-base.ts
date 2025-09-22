function a(param1: string): void {
  console.log(param1);
}

export function b(param1: number, param2: boolean): number {
  if (param2) {
    return param1 * 2;
  }
  return param1;
}

function d() {
  // a simple function
}
