type MyType = string | number | boolean; // definition changed

type NewType = { a: number }; // added

const a: any = 1; // type changed
// let b = 'hello'; // removed (not detected)
const c = true; // added
