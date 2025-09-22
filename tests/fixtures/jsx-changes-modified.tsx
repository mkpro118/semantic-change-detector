import React from 'react';

const MyComponent = () => <div>Hello</div>;
const AnotherComponent = () => <p>Another</p>;

function App({ show, items }) {
  const handleClick = () => console.log('clicked');

  return (
    <div onClick={handleClick}>
      {' '}
      {/* eventHandlerChanged */}
      <h1>Title</h1>
      {/* element removed, not detected */}
      <span>Subtitle</span> {/* jsxElementAdded */}
      {show && <AnotherComponent />} {/* jsxLogicAdded, componentReferenceChanged */}
    </div>
  );
}
