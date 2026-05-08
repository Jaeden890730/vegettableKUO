import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import AdminPendingSettlement from './AdminPendingSettlement';
import AdminSettlements from './AdminSettlements';

export default function AdminSettlementCenter() {
  const [synced, setSynced] = useState(true);
  const [sharedFilter, setSharedFilter] = useState<string>('all');
  const [pendingFilter, setPendingFilter] = useState<string>('all');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');

  const handleSyncToggle = (checked: boolean) => {
    if (checked) {
      // When enabling sync, adopt the pending side's current value
      setSharedFilter(pendingFilter);
    }
    setSynced(checked);
  };

  const syncControl = (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <Checkbox
        checked={synced}
        onCheckedChange={(c) => handleSyncToggle(!!c)}
      />
      <span>同步右側篩選</span>
    </label>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="min-w-0">
        <AdminPendingSettlement
          customerFilter={synced ? sharedFilter : pendingFilter}
          onCustomerFilterChange={synced ? setSharedFilter : setPendingFilter}
          syncControl={syncControl}
        />
      </div>
      <div className="min-w-0 xl:border-l xl:pl-6">
        <AdminSettlements
          customerFilter={synced ? sharedFilter : settlementFilter}
          onCustomerFilterChange={synced ? setSharedFilter : setSettlementFilter}
        />
      </div>
    </div>
  );
}
