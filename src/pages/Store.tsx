import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Minus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { feedbackText, getApiErrorMessage } from "@/lib/feedback";

interface Product {
  id: string;
  name: string;
  priceCents: number;
  category: string | null;
  imageUrl: string | null;
  sizes?: string[];
  active: boolean;
}

interface CartItem extends Product {
  quantity: number;
  selectedSize?: string;
}

const Store = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "paid" | "failed">("idle");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  useEffect(() => {
    const load = async () => {
      const resp = await apiFetch("/api/products?active=true");
      if (resp.ok) {
        setProducts(await resp.json());
      } else {
        toast.error(await getApiErrorMessage(resp, "Failed to load store items"));
      }
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ["All", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = activeCategory === "All"
    ? products
    : products.filter((p) => p.category === activeCategory);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart.`);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.priceCents / 100) * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalCents = Math.round(cartTotal * 100);

  const openCheckout = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setPaymentOrderId(null);
    setPaymentStatus("idle");
    setCheckoutOpen(true);
  };

  useEffect(() => {
    if (!checkoutOpen || !paymentOrderId || paymentStatus !== "pending") return;
    let active = true;

    const poll = async () => {
      const resp = await apiFetch(`/api/payments/mpesa/status/${paymentOrderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => null);
      if (!active || !data) return;

      const orderStatus = data?.order?.status;
      const transactionStatus = data?.transaction?.status;

      if (orderStatus === "paid" || transactionStatus === "paid") {
        setPaymentStatus("paid");
        setCheckoutSuccess("Payment received. Your order is confirmed.");
      } else if (orderStatus === "cancelled" || transactionStatus === "failed") {
        setPaymentStatus("failed");
        setCheckoutError("Payment failed or was cancelled. Please try again.");
      }
    };

    const intervalId = window.setInterval(poll, 4000);
    poll();

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [checkoutOpen, paymentOrderId, paymentStatus, token]);

  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setCheckoutError("Name and phone are required.");
      toast.error("Name and phone are required.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const orderItems = cart.map((item) => ({
        productId: item.id,
        name: item.name,
        priceCents: item.priceCents,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        imageUrl: item.imageUrl,
      }));

      const resp = await apiFetch("/api/payments/mpesa/stkpush", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          phoneNumber: customerPhone,
          items: orderItems,
        }),
      });

      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Failed to place order"));
      }

      const data = await resp.json().catch(() => ({}));
      const customerMessage = data?.response?.CustomerMessage;
      setCheckoutSuccess(
        customerMessage || "M-Pesa prompt sent. Complete the payment on your phone."
      );
      toast.success(customerMessage || "M-Pesa prompt sent. Complete payment on your phone.");
      if (data?.orderId) {
        setPaymentOrderId(data.orderId);
        setPaymentStatus("pending");
      }
      setCart([]);
      setIsCartOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to place order.";
      setCheckoutError(message);
      toast.error(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider animate-fade-in">
              MERCH <span className="text-primary">STORE</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Premium apparel and accessories for true car enthusiasts.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "hero" : "secondary"}
                  size="default"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            {filteredProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                No store items available yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {filteredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-500 hover:border-primary/50 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img
                        src={resolveImageUrl(product.imageUrl) || "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {product.category && (
                        <Badge className="absolute top-3 left-3 bg-secondary text-secondary-foreground">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-xl tracking-wider break-words">{product.name}</h3>
                      <div className="mt-auto flex flex-col gap-4 pt-4">
                        <span className="font-display text-2xl text-primary break-words">
                          KES {(product.priceCents / 100).toLocaleString()}
                        </span>
                        <Button variant="hero" size="sm" className="w-full" onClick={() => addToCart(product)}>
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-glow hover:scale-110 transition-transform z-40"
      >
        <ShoppingCart className="w-6 h-6 text-primary-foreground" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs flex items-center justify-center font-bold">
            {cartCount}
          </span>
        )}
      </button>

      {isCartOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setIsCartOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 animate-slide-in-left overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-2xl tracking-wider">YOUR CART</h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={24} />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-6 border-b border-border">
                        <img
                          src={resolveImageUrl(item.imageUrl) || "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600"}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-primary font-display text-lg">
                            KES {(item.priceCents / 100).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="ml-auto text-muted-foreground hover:text-destructive"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-lg">Total</span>
                      <span className="font-display text-3xl text-primary">
                        KES {cartTotal.toLocaleString()}
                      </span>
                    </div>
                    <Button variant="hero" size="xl" className="w-full" onClick={openCheckout}>
                      Checkout
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Confirm your customer details and delivery information before we send the M-Pesa payment prompt for this order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Delivery Address (optional)</Label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            {checkoutError && <p className="text-sm text-destructive">{checkoutError}</p>}
            {checkoutSuccess && <p className="text-sm text-emerald-500">{checkoutSuccess}</p>}
            {paymentStatus === "pending" && (
              <p className="text-sm text-muted-foreground">
                Waiting for M-Pesa confirmation...
              </p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span>Total</span>
              <span className="font-display text-xl text-primary">
                KES {cartTotal.toLocaleString()}
              </span>
            </div>
          </div>
          <DialogFooter>
            {paymentStatus === "paid" || checkoutSuccess ? (
              <Button variant="hero" onClick={() => setCheckoutOpen(false)}>
                Done
              </Button>
            ) : (
              <Button variant="hero" onClick={submitOrder} disabled={checkoutLoading}>
                {checkoutLoading ? "Requesting..." : "Pay with M-Pesa"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Store;
