import React, { useReducer, useContext, createContext, useCallback, useMemo } from 'react';

export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  inStock: boolean;
  description?: string;
}

export interface CartItem extends Product {
  quantity: number;
  addedAt: Date;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  discountCode?: string;
  discountAmount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'APPLY_DISCOUNT'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'RESTORE_CART'; payload: CartState };

const calculateTotal = (items: CartItem[], discountAmount: number = 0): number => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Math.max(0, subtotal - discountAmount);
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find((item) => item.id === action.payload.id);

      if (existingItem) {
        const updatedItems = state.items.map((item) =>
          item.id === action.payload.id ? { ...item, quantity: item.quantity + 1 } : item,
        );

        return {
          ...state,
          items: updatedItems,
          total: calculateTotal(updatedItems, state.discountAmount),
          itemCount: updatedItems.reduce((count, item) => count + item.quantity, 0),
        };
      } else {
        const newItem: CartItem = {
          ...action.payload,
          quantity: 1,
          addedAt: new Date(),
        };
        const updatedItems = [...state.items, newItem];

        return {
          ...state,
          items: updatedItems,
          total: calculateTotal(updatedItems, state.discountAmount),
          itemCount: updatedItems.reduce((count, item) => count + item.quantity, 0),
        };
      }
    }

    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter((item) => item.id !== action.payload);
      return {
        ...state,
        items: updatedItems,
        total: calculateTotal(updatedItems, state.discountAmount),
        itemCount: updatedItems.reduce((count, item) => count + item.quantity, 0),
      };
    }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: action.payload.id });
      }

      const updatedItems = state.items.map((item) =>
        item.id === action.payload.id ? { ...item, quantity: action.payload.quantity } : item,
      );

      return {
        ...state,
        items: updatedItems,
        total: calculateTotal(updatedItems, state.discountAmount),
        itemCount: updatedItems.reduce((count, item) => count + item.quantity, 0),
      };
    }

    case 'APPLY_DISCOUNT': {
      const discountAmount = getDiscountAmount(action.payload, state.total);
      return {
        ...state,
        discountCode: action.payload,
        discountAmount,
        total: calculateTotal(state.items, discountAmount),
      };
    }

    case 'CLEAR_CART': {
      return {
        items: [],
        total: 0,
        itemCount: 0,
        discountAmount: 0,
      };
    }

    case 'RESTORE_CART': {
      return action.payload;
    }

    default:
      return state;
  }
};

const getDiscountAmount = (code: string, total: number): number => {
  const discounts: Record<string, (total: number) => number> = {
    SAVE10: (total) => total * 0.1,
    SAVE20: (total) => total * 0.2,
    FIXED5: () => 5,
    FIXED10: () => 10,
  };

  return discounts[code]?.(total) || 0;
};

interface CartContextType {
  state: CartState;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyDiscount: (code: string) => boolean;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: React.ReactNode;
  initialState?: Partial<CartState>;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children, initialState }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    total: 0,
    itemCount: 0,
    discountAmount: 0,
    ...initialState,
  });

  const addItem = useCallback((product: Product) => {
    if (!product.inStock) {
      throw new Error('Product is out of stock');
    }
    dispatch({ type: 'ADD_ITEM', payload: product });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity } });
  }, []);

  const applyDiscount = useCallback((code: string): boolean => {
    const validCodes = ['SAVE10', 'SAVE20', 'FIXED5', 'FIXED10'];
    if (validCodes.includes(code)) {
      dispatch({ type: 'APPLY_DISCOUNT', payload: code });
      return true;
    }
    return false;
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const isInCart = useCallback(
    (productId: string): boolean => {
      return state.items.some((item) => item.id === productId);
    },
    [state.items],
  );

  const getItemQuantity = useCallback(
    (productId: string): number => {
      const item = state.items.find((item) => item.id === productId);
      return item?.quantity || 0;
    },
    [state.items],
  );

  const value = useMemo(
    () => ({
      state,
      addItem,
      removeItem,
      updateQuantity,
      applyDiscount,
      clearCart,
      isInCart,
      getItemQuantity,
    }),
    [
      state,
      addItem,
      removeItem,
      updateQuantity,
      applyDiscount,
      clearCart,
      isInCart,
      getItemQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

interface CartItemComponentProps {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}

const CartItemComponent: React.FC<CartItemComponentProps> = ({
  item,
  onRemove,
  onUpdateQuantity,
}) => {
  const handleQuantityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newQuantity = parseInt(e.target.value);
    onUpdateQuantity(item.id, newQuantity);
  };

  const itemTotal = item.price * item.quantity;

  return (
    <div className="cart-item">
      <div className="item-info">
        {item.image && <img src={item.image} alt={item.name} className="item-image" />}
        <div className="item-details">
          <h4>{item.name}</h4>
          <p className="item-category">{item.category}</p>
          <p className="item-price">${item.price.toFixed(2)}</p>
        </div>
      </div>

      <div className="item-controls">
        <label>
          Quantity:
          <select value={item.quantity} onChange={handleQuantityChange}>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>

        <button
          className="remove-button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} from cart`}
        >
          Remove
        </button>
      </div>

      <div className="item-total">${itemTotal.toFixed(2)}</div>
    </div>
  );
};

export const CartSummary: React.FC = () => {
  const { state } = useCart();

  if (state.items.length === 0) {
    return (
      <div className="cart-summary empty">
        <h3>Your cart is empty</h3>
        <p>Add some items to get started!</p>
      </div>
    );
  }

  return (
    <div className="cart-summary">
      <h3>Cart Summary</h3>

      <div className="summary-line">
        <span>Items ({state.itemCount}):</span>
        <span>${(state.total + state.discountAmount).toFixed(2)}</span>
      </div>

      {state.discountAmount > 0 && (
        <div className="summary-line discount">
          <span>Discount ({state.discountCode}):</span>
          <span>-${state.discountAmount.toFixed(2)}</span>
        </div>
      )}

      <div className="summary-line total">
        <strong>
          <span>Total:</span>
          <span>${state.total.toFixed(2)}</span>
        </strong>
      </div>
    </div>
  );
};
