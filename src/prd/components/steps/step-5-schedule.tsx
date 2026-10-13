

import type { PrdDocument } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RepeatableField } from '../repeatable-field';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step5Schedule({ prdData, onDataChange }: StepProps) {
  
  const handleUpdateMilestone = (index: number, part: 'name' | 'date' | 'owner', value: string) => {
    const newMilestones = [...prdData.milestones];
    newMilestones[index] = { ...newMilestones[index], [part]: value };
    onDataChange({ milestones: newMilestones });
  };

  const handleAddMilestone = () => {
    onDataChange({ milestones: [...prdData.milestones, { name: '', date: '', owner: '' }] });
  };

  const handleRemoveMilestone = (index: number) => {
    const newMilestones = prdData.milestones.filter((_, i) => i !== index);
    onDataChange({ milestones: newMilestones });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>마일스톤</Label>
        <div className="space-y-2 mt-4">
          {prdData.milestones.map((milestone, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="col-span-12 md:col-span-5">
                <Input value={milestone.name} onChange={e => handleUpdateMilestone(index, 'name', e.target.value)} placeholder="마일스톤 이름" />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Input type="date" value={milestone.date} onChange={e => handleUpdateMilestone(index, 'date', e.target.value)} />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Input value={milestone.owner} onChange={e => handleUpdateMilestone(index, 'owner', e.target.value)} placeholder="담당자" />
              </div>
              <div className="col-span-12 md:col-span-1">
                <Button variant="ghost" size="icon" onClick={() => handleRemoveMilestone(index)} className="hover:bg-destructive hover:text-destructive-foreground w-full md:w-auto">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {prdData.milestones.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">항목이 없습니다.</p>}
        </div>
        <div className="text-center mt-4">
            <Button variant="outline" size="sm" onClick={handleAddMilestone}>
              <Plus className="mr-2 h-4 w-4" /> 추가
            </Button>
        </div>
      </div>
      
      <RepeatableField
        title="담당자 / 스테이크홀더"
        items={prdData.stakeholders}
        updateItems={stakeholders => onDataChange({ stakeholders })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => (
          <div className="flex items-center gap-2">
            <Input value={item} onChange={e => onChange(e.target.value)} placeholder="예: 개발팀, 디자인팀" />
            <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
    </div>
  );
}
