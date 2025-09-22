class Base {}

class A extends Base {
  prop1: string = 'hello';
  method1() {}
}

class B {} // Will be removed

class C {
  // Will change inheritance
}
