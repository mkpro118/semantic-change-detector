interface A {
  // property added and changed
  prop1: number; // type changed
  prop2?: boolean; // optional property added
}

interface B {
  method1(): void;
  method2(): string; // method added
}

// interface C is removed (not detected)

interface D {
  // interface added
  prop: any;
}
