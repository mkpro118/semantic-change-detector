import { useState, useEffect, useMemo } from 'react';

function MyComponent({ propA, propB }) {
  const [state, setState] = useState(0);
  const [another, setAnother] = useState(''); // hook added

  useEffect(() => {
    console.log('Mounted'); // already present
    console.log('Updated'); // side effect added
    document.title = 'World'; // side effect call changed, but analyzer may not see it
  }, []);

  useEffect(() => {
    // Effect with deps
  }, [propA, propB]); // dependency changed

  const memo = useMemo(() => state * 2, [state]); // hook added
}
