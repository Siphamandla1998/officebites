import { useEffect, useState } from 'react';
import { deliveryDateKey, nextOrderableDate } from '../utils/orderRules';

export function useDeliveryDate() {
  const [key, setKey] = useState(() => deliveryDateKey(nextOrderableDate()));
  useEffect(() => {
    const update = () => setKey(deliveryDateKey(nextOrderableDate()));
    const timer = setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return key;
}
