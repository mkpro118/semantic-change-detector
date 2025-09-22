// function a is removed

// signature changed & complexity changed
export function b(param1: number, param2: string): string {
  if (param2 === 'double' && param1 > 0) {
    // +2
    if (param1 > 10) {
      // +1
      if (param1 > 100) {
        // +1
        return (param1 * 4).toString();
      }
      return (param1 * 2).toString();
    }
  } else if (param2 === 'triple') {
    // +1
    return (param1 * 3).toString();
  }
  return param1.toString();
}

function c(param1: any): void {
  // added
  console.log(param1);
}

// function d is removed
