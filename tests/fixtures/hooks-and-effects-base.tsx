import { useState, useEffect } from 'react';

function MyComponent({ propA, propB }) {
  const [state, setState] = useState(0);

  useEffect(() => {
    console.log('Mounted');
    document.title = 'Hello';
  }, []);

  useEffect(() => {
    // Effect with deps
  }, [propA, state]);
}
