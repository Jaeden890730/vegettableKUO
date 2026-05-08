import { Phone, MessageCircle, MapPin, Clock } from 'lucide-react';

export function ContactSection() {
  // Use hardcoded default - no API call needed on homepage load
  const phone = '0932-916-940';

  // Format phone for tel: link (remove dashes)
  const phoneLink = phone.replace(/-/g, '');

  return <section id="contact" className="bg-secondary py-6">
      <div className="container">
        <h2 className="mb-4 text-center text-lg font-bold text-foreground">聯絡我們</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Phone */}
          <a href={`tel:${phoneLink}`} className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm transition-all active:scale-[0.98]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">電話</p>
              <p className="font-bold text-foreground">{phone}</p>
            </div>
          </a>

          {/* LINE */}
          <a href="https://line.me/ti/p/RWactrOFVv" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm transition-all active:scale-[0.98]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <MessageCircle className="h-5 w-5 text-success" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">LINE</p>
              <p className="font-bold text-foreground">點選LINE圖標加入好友</p>
            </div>
          </a>

          {/* Business hours */}
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">營業時間</p>
              <p className="font-bold text-foreground text-sm">凌晨3:00-中午12:00</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">配送地點</p>
              <p className="font-bold text-foreground text-sm">中和 永和 板橋 土城 萬華 中正
鄰近區域可來電詢問</p>
            </div>
          </div>
        </div>

        {/* About section */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <h3 className="mb-2 font-bold text-foreground">關於我們</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            ⚠️ 價格每日依凌晨拍賣行情變動，以現場為準
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-3 py-1">每日凌晨進貨</span>
            <span className="rounded-full bg-primary/10 px-3 py-1">穩定供貨</span>
            <span className="rounded-full bg-primary/10 px-3 py-1">品質保證</span>
            <span className="rounded-full bg-primary/10 px-3 py-1">長期配合歡迎</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          © 2024 新鮮蔬菜｜價格以現場為準
        </p>
      </div>
    </section>;
}