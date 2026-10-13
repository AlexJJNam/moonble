

import type { PrdDocument } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step6Metrics({ prdData, onDataChange }: StepProps) {

  const handleUpdateEvent = (index: number, part: 'event' | 'definition', value: string) => {
    const newEvents = [...prdData.analyticsEvents];
    newEvents[index] = { ...newEvents[index], [part]: value };
    onDataChange({ analyticsEvents: newEvents });
  };

  const handleAddEvent = () => {
    onDataChange({ analyticsEvents: [...prdData.analyticsEvents, { event: '', definition: '' }] });
  };

  const handleRemoveEvent = (index: number) => {
    const newEvents = prdData.analyticsEvents.filter((_, i) => i !== index);
    onDataChange({ analyticsEvents: newEvents });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="northStarMetric">북극성 지표</Label>
        <Input id="northStarMetric" value={prdData.northStarMetric} onChange={e => onDataChange({ northStarMetric: e.target.value })} placeholder="예: 주간 PRD 생성 수" />
      </div>

      <div>
        <Label>주요 이벤트 (Analytics)</Label>
        <div className="space-y-2 mt-4">
          {prdData.analyticsEvents.map((event, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-5 md:col-span-4">
                <Input value={event.event} onChange={e => handleUpdateEvent(index, 'event', e.target.value)} placeholder="이벤트 이름 (예: pdf_exported)" />
              </div>
              <div className="col-span-12 sm:col-span-7 md:col-span-7">
                <Input value={event.definition} onChange={e => handleUpdateEvent(index, 'definition', e.target.value)} placeholder="이벤트 정의" />
              </div>
              <div className="col-span-12 md:col-span-1">
                <Button variant="ghost" size="icon" onClick={() => handleRemoveEvent(index)} className="hover:bg-destructive hover:text-destructive-foreground w-full md:w-auto">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {prdData.analyticsEvents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">항목이 없습니다.</p>}
        </div>
        <div className="text-center mt-4">
          <Button variant="outline" size="sm" onClick={handleAddEvent}>
            <Plus className="mr-2 h-4 w-4" /> 추가
          </Button>
        </div>
      </div>
      {/* A/B Test section can be added here following a similar pattern */}
    </div>
  );
}
