import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, MessageCircle, Info, ExternalLink, CheckCircle, Plus, Trash2, Users, Store } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TelegramRecipient {
  id?: string;
  name: string;
  chatId: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recipients, setRecipients] = useState<TelegramRecipient[]>([]);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [isSavingStoreName, setIsSavingStoreName] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Parse store name
      const storeNameSetting = data?.find(s => s.key === 'store_name');
      if (storeNameSetting?.value) {
        setStoreName(storeNameSetting.value);
      }

      // Parse recipients from settings
      const recipientMap = new Map<string, TelegramRecipient>();
      data?.filter(s => s.key.startsWith('telegram_recipient_')).forEach((setting) => {
        const match = setting.key.match(/telegram_recipient_(\d+)_(name|chat_id)/);
        if (match) {
          const index = match[1];
          const field = match[2];
          if (!recipientMap.has(index)) {
            recipientMap.set(index, { id: index, name: '', chatId: '' });
          }
          const recipient = recipientMap.get(index)!;
          if (field === 'name') {
            recipient.name = setting.value || '';
          } else if (field === 'chat_id') {
            recipient.chatId = setting.value || '';
          }
        }
      });

      setRecipients(Array.from(recipientMap.values()).filter(r => r.name || r.chatId));
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: '載入失敗',
        description: '無法載入設定',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStoreName = async () => {
    if (!storeName.trim()) {
      toast({
        title: '請輸入店名',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingStoreName(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'store_name', value: storeName.trim(), label: '店名' },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast({
        title: '店名已更新',
      });
    } catch (error) {
      console.error('Error saving store name:', error);
      toast({
        title: '儲存失敗',
        variant: 'destructive',
      });
    } finally {
      setIsSavingStoreName(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipientName.trim() || !newChatId.trim()) {
      toast({
        title: '請填寫完整資訊',
        description: '接收人名稱和 Chat ID 都需要填寫',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newIndex = Date.now().toString();
      const updates = [
        { key: `telegram_recipient_${newIndex}_name`, value: newRecipientName.trim(), label: '接收人名稱' },
        { key: `telegram_recipient_${newIndex}_chat_id`, value: newChatId.trim(), label: 'Chat ID' },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(
            { key: update.key, value: update.value, label: update.label },
            { onConflict: 'key' }
          );

        if (error) throw error;
      }

      toast({
        title: '新增成功',
        description: `已新增接收人：${newRecipientName}`,
      });

      setNewRecipientName('');
      setNewChatId('');
      fetchSettings();
    } catch (error) {
      console.error('Error adding recipient:', error);
      toast({
        title: '新增失敗',
        description: '無法新增接收人',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    try {
      const keysToDelete = [
        `telegram_recipient_${recipientId}_name`,
        `telegram_recipient_${recipientId}_chat_id`,
      ];

      for (const key of keysToDelete) {
        const { error } = await supabase
          .from('app_settings')
          .delete()
          .eq('key', key);

        if (error) throw error;
      }

      toast({
        title: '刪除成功',
      });

      fetchSettings();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast({
        title: '刪除失敗',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = async (chatId: string, name: string) => {
    if (!chatId) {
      toast({
        title: '沒有 Chat ID',
        variant: 'destructive',
      });
      return;
    }

    setTestingId(chatId);
    try {
      const { error } = await supabase.functions.invoke('notify-telegram', {
        body: {
          type: 'order',
          customerName: '測試客戶',
          orderNumber: 'TEST001',
          items: [{ name: '測試品項', quantity: 1, unit: '斤' }],
          note: '這是測試訊息',
          targetChatId: chatId,
        },
      });

      if (error) throw error;

      toast({
        title: '測試訊息已發送',
        description: `已發送給 ${name}`,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: '發送失敗',
        description: '請確認 Chat ID 是否正確',
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">系統設定</h2>
        <p className="text-muted-foreground">管理店名、通知與系統設定</p>
      </div>

      {/* Store Name Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            店名設定
          </CardTitle>
          <CardDescription>
            設定店名會顯示在傳單上
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="請輸入店名"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveStoreName} disabled={isSavingStoreName}>
              {isSavingStoreName ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              儲存
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Telegram Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Telegram 通知設定
          </CardTitle>
          <CardDescription>
            管理接收訂單通知的 Telegram 帳號（可設定多位接收人）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Recipients */}
          {recipients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                目前會收到通知的接收人
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>接收人名稱</TableHead>
                    <TableHead>Chat ID</TableHead>
                    <TableHead className="w-[180px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="font-medium">{recipient.name}</TableCell>
                      <TableCell className="font-mono text-sm">{recipient.chatId}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestNotification(recipient.chatId, recipient.name)}
                            disabled={testingId === recipient.chatId}
                          >
                            {testingId === recipient.chatId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3 w-3" />
                            )}
                            <span className="ml-1">測試</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteRecipient(recipient.id!)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {recipients.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>尚未設定接收人</AlertTitle>
              <AlertDescription>
                請在下方新增 Telegram 接收人，才能收到訂單通知
              </AlertDescription>
            </Alert>
          )}

          {/* Add New Recipient */}
          <div className="space-y-3 pt-4 border-t">
            <div className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              新增接收人
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newRecipientName">接收人名稱</Label>
                <Input
                  id="newRecipientName"
                  placeholder="例如：老闆、倉管"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newChatId">Chat ID</Label>
                <Input
                  id="newChatId"
                  placeholder="例如：123456789"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAddRecipient} disabled={isSaving || !newRecipientName.trim() || !newChatId.trim()}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              新增接收人
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tutorial Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            如何取得 Telegram Chat ID
          </CardTitle>
          <CardDescription>
            按照以下步驟取得您的 Chat ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="step1">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    1
                  </span>
                  開啟 Telegram 並搜尋 @userinfobot
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pl-8">
                <p>在 Telegram 的搜尋欄中輸入 <code className="rounded bg-muted px-1.5 py-0.5">@userinfobot</code></p>
                <p>這是一個官方機器人，可以告訴你你的 Chat ID</p>
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  點此直接開啟 @userinfobot
                  <ExternalLink className="h-3 w-3" />
                </a>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step2">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    2
                  </span>
                  點擊「開始」或發送任意訊息
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pl-8">
                <p>進入 @userinfobot 的聊天室後，點擊底部的「開始」按鈕</p>
                <p>或者直接發送任意訊息給它</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step3">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                  複製回傳的 ID 數字
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pl-8">
                <p>機器人會回傳一段訊息，包含你的資訊：</p>
                <div className="rounded-lg bg-muted p-3 font-mono text-sm">
                  <p>Id: <strong className="text-primary">123456789</strong></p>
                  <p>First: 你的名字</p>
                  <p>Lang: zh-hant</p>
                </div>
                <p className="font-medium">
                  複製 <code className="rounded bg-muted px-1.5 py-0.5">Id:</code> 後面的數字，貼到上方的 Chat ID 欄位
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step4">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    4
                  </span>
                  與通知機器人開始對話
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pl-8">
                <p>搜尋並開啟您的訂單通知機器人</p>
                <p className="text-amber-600 dark:text-amber-400">
                  ⚠️ 重要：您必須先向機器人發送一則訊息（例如「開始」），機器人才能向您發送通知！
                </p>
                <p>完成後，點擊上方的「測試」按鈕確認設定正確</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Alert className="mt-4" variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>
              Chat ID 是一串純數字，通常是 9-10 位數。如果您在群組中使用，群組 ID 會是負數（例如 -123456789）。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
