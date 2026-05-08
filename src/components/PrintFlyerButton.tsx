import { useState, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Vegetable } from '@/types/vegetable';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  vegetables: Vegetable[];
  qrCodeUrl?: string;
}

export function PrintFlyerButton({ vegetables, qrCodeUrl }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [storeName, setStoreName] = useState('旭海 餐飲蔬菜供應');
  const [phone, setPhone] = useState('0932-916-940');
  const flyerRef = useRef<HTMLDivElement>(null);
  const settingsFetched = useRef(false);

  // Lazy fetch settings only when generating (not on mount)
  const ensureSettings = async () => {
    if (settingsFetched.current) return;
    settingsFetched.current = true;
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['store_name', 'phone']);
    
    if (data) {
      data.forEach(item => {
        if (item.key === 'store_name' && item.value) setStoreName(item.value);
        if (item.key === 'phone' && item.value) setPhone(item.value);
      });
    }
  };

  const websiteUrl = qrCodeUrl || 'https://fresh-daily-deal.lovable.app';

  const handlePrint = async () => {
    setIsGenerating(true);
    await ensureSettings();
    try {
      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!flyerRef.current) return;

      const canvas = await html2canvas(flyerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`菜價傳單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

  // Filter only in-stock vegetables
  const inStockVegs = vegetables.filter(v => v.status === 'in_stock');

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        disabled={isGenerating}
        className="gap-1.5"
      >
        <Printer className="h-4 w-4" />
        {isGenerating ? '生成中...' : '列印傳單'}
      </Button>

      {/* Hidden flyer for PDF generation */}
      <div className="fixed left-[-9999px] top-0">
        <div
          ref={flyerRef}
          style={{
            width: '210mm',
            height: '297mm',
            padding: '8mm',
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, "Microsoft JhengHei", sans-serif',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ 
            backgroundColor: '#16a34a', 
            color: '#ffffff', 
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              🥬 {storeName}
            </h1>
            <p style={{ fontSize: '14px', margin: 0, opacity: 0.9 }}>
              每日凌晨進貨 ｜ 穩定供貨 ｜ 品質保證
            </p>
          </div>

          {/* Date & Time */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            padding: '0 4px',
          }}>
            <div style={{ fontSize: '14px', color: '#374151' }}>
              <strong>📅 日期：</strong>{dateStr}
            </div>
            <div style={{ fontSize: '14px', color: '#374151' }}>
              <strong>🕐 更新時間：</strong>{timeStr}
            </div>
          </div>

          {/* Price List */}
          <div style={{ 
            flex: 1,
            border: '2px solid #16a34a',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '10px',
          }}>
            <div style={{ 
              backgroundColor: '#dcfce7', 
              padding: '8px 12px',
              borderBottom: '2px solid #16a34a',
              display: 'flex',
              fontWeight: 'bold',
              fontSize: '13px',
              color: '#166534',
            }}>
              <div style={{ flex: 2 }}>品項</div>
              <div style={{ flex: 3, textAlign: 'right' }}>價格</div>
            </div>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0',
            }}>
              {inStockVegs.map((veg, index) => {
                const prices = veg.prices && veg.prices.length > 0 
                  ? veg.prices 
                  : [{ price: veg.price, unit: veg.unit }];
                const priceStr = prices.map(p => `$${p.price}/${p.unit}`).join(' ');
                
                return (
                  <div
                    key={veg.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: index % 4 < 2 ? '#f0fdf4' : '#ffffff',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: index % 2 === 0 ? '1px solid #e5e7eb' : 'none',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: '#1f2937' }}>{veg.name}</span>
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{priceStr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Banner */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '10px',
            textAlign: 'center',
          }}>
            <p style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              color: '#92400e',
              margin: 0,
            }}>
              🚚 提供配送服務！中和、永和、板橋、土城、萬華、中正區
            </p>
            <p style={{ fontSize: '12px', color: '#92400e', margin: '4px 0 0 0' }}>
              鄰近區域可來電詢問
            </p>
            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', margin: '6px 0 0 0' }}>
              當日下單隔日配送運費$200　滿$999免運
            </p>
          </div>

          {/* Contact & QR Code */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            padding: '12px 16px',
            gap: '12px',
          }}>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                <strong>📞 電話：</strong>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>{phone}</span>
              </div>
              <div style={{ fontSize: '14px' }}>
                <strong>🕐 每日結單時間：</strong>晚上 12:00
              </div>
            </div>
            
            {websiteUrl && (
              <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                <QRCodeSVG 
                  value={websiteUrl} 
                  size={80} 
                  level="M"
                  includeMargin={false}
                />
                <p style={{ fontSize: '10px', color: '#6b7280', margin: '4px 0 0 0' }}>
                  掃碼查看最新菜價
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
