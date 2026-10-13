

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

interface RepeatableFieldProps<T> {
  title: string;
  items: T[];
  updateItems: (newItems: T[]) => void;
  renderItem: (item: T, onChange: (value: T) => void, onRemove: () => void) => React.ReactNode;
  newItemFactory: () => T;
  className?: string;
}

export function RepeatableField<T>({ title, items, updateItems, renderItem, newItemFactory, className }: RepeatableFieldProps<T>) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [itemIndexToRemove, setItemIndexToRemove] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const handleAddItem = () => {
    updateItems([...items, newItemFactory()]);
  };

  const handleUpdateItem = (index: number, value: T) => {
    const newItems = [...items];
    newItems[index] = value;
    updateItems(newItems);
  };
  
  const requestRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItemIndexToRemove(index);
      setIsAlertOpen(true);
    } else {
      handleRemoveItem(index);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      // If the last item is being removed, replace it with a new blank item.
      updateItems([newItemFactory()]);
    } else {
      updateItems(newItems);
    }
  };
  
  const confirmRemove = () => {
    if (itemIndexToRemove !== null) {
      handleRemoveItem(itemIndexToRemove);
    }
    setIsAlertOpen(false);
    setItemIndexToRemove(null);
  };

  const cancelRemove = () => {
    setIsAlertOpen(false);
    setItemIndexToRemove(null);
  };

  const AlertContent = () => (
    <>
        <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
                이 섹션의 마지막 항목입니다. 정말 삭제하시겠습니까? 삭제 시, 항목은 초기화됩니다.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRemove}>아니오</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>예, 삭제합니다</AlertDialogAction>
        </AlertDialogFooter>
    </>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <Label>{title}</Label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index}>
            {renderItem(
              item,
              (value) => handleUpdateItem(index, value),
              () => requestRemoveItem(index)
            )}
          </div>
        ))}
        {items.length === 0 && (
            <div className="text-center">
                 <p className="text-sm text-muted-foreground text-center py-4">항목이 없습니다. 항목을 추가해주세요.</p>
            </div>
        )}
      </div>
      <div className="text-center">
        <Button variant="outline" size="sm" onClick={handleAddItem}>
          <Plus className="mr-2 h-4 w-4" /> 추가
        </Button>
      </div>

       {isMobile ? (
         <Sheet open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <SheetContent side="bottom">
                <SheetHeader>
                    <SheetTitle>항목 삭제</SheetTitle>
                    <SheetDescription>이 섹션의 마지막 항목입니다. 정말 삭제하시겠습니까? 삭제 시, 항목은 초기화됩니다.</SheetDescription>
                </SheetHeader>
                <SheetFooter className="grid grid-cols-2 gap-2 pt-4">
                    <Button onClick={confirmRemove} variant="destructive">예, 삭제합니다</Button>
                    <Button onClick={cancelRemove} variant="outline">아니오</Button>
                </SheetFooter>
            </SheetContent>
         </Sheet>
       ) : (
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
                <AlertContent />
            </AlertDialogContent>
        </AlertDialog>
       )}
    </div>
  );
}
