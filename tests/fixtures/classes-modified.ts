class Base {}

class A extends Base {
  prop1: string = 'hello';
  prop2: number = 123; // added property

  method1() {}
  method2(): boolean {
    return false;
  } // added method
}

// class B is removed (should not be detected)

class C extends Base {
  // inheritance changed
}

class D {} // added class
