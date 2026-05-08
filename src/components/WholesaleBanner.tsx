import { Store, MessageCircle } from 'lucide-react';

export function WholesaleBanner() {
  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary border-b border-primary/20">
      <div className="container py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">餐廳、攤商批發歡迎洽詢</p>
            <p className="text-sm text-muted-foreground">大量另有優惠｜長期配合價格另議</p>
          </div>
          <a
            href="#contact"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
