

import type { PrdDocument } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step4Requirements({ prdData, onDataChange }: StepProps) {
  const handleUpdateRequirement = (index: number, part: 'priority' | 'text' | 'type', value: string) => {
    const newRequirements = [...prdData.requirements];
    newRequirements[index] = { ...newRequirements[index], [part]: value };
    onDataChange({ requirements: newRequirements });
  };

  const handleAddRequirement = () => {
    onDataChange({ requirements: [...prdData.requirements, { type: 'functional', priority: 'Must', text: '' }] });
  };

  const handleRemoveRequirement = (index: number) => {
    const newRequirements = prdData.requirements.filter((_, i) => i !== index);
    onDataChange({ requirements: newRequirements });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>요구사항</Label>
        <div className="space-y-2 mt-4">
          {prdData.requirements.map((req, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-4 md:col-span-3">
                <Select value={req.priority} onValueChange={(value) => handleUpdateRequirement(index, 'priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="우선순위" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Must">Must</SelectItem>
                    <SelectItem value="Should">Should</SelectItem>
                    <SelectItem value="Could">Could</SelectItem>
                    <SelectItem value="Won't">Won't</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-8 md:col-span-8">
                <Input value={req.text} onChange={e => handleUpdateRequirement(index, 'text', e.target.value)} placeholder="요구사항 내용" />
              </div>
              <div className="col-span-12 md:col-span-1">
                <Button variant="ghost" size="icon" onClick={() => handleRemoveRequirement(index)} className="hover:bg-destructive hover:text-destructive-foreground w-full md:w-auto">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {prdData.requirements.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">항목이 없습니다.</p>}
        </div>
        <div className="text-center mt-4">
          <Button variant="outline" size="sm" onClick={handleAddRequirement}>
            <Plus className="mr-2 h-4 w-4" /> 추가
          </Button>
        </div>
      </div>
    </div>
  );
}
