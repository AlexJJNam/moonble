

import type { PrdDocument, UserStory } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RepeatableField } from '../repeatable-field';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step3UserScenario({ prdData, onDataChange }: StepProps) {
  const handleUpdateUserStory = (index: number, part: 'asA' | 'iWant' | 'soThat', value: string) => {
    const newUserStories = [...prdData.userStories];
    newUserStories[index] = { ...newUserStories[index], [part]: value };
    onDataChange({ userStories: newUserStories });
  };

  const handleAddUserStory = () => {
    onDataChange({ userStories: [...prdData.userStories, { asA: '', iWant: '', soThat: '' }] });
  };

  const handleRemoveUserStory = (index: number) => {
    const newUserStories = prdData.userStories.filter((_, i) => i !== index);
    onDataChange({ userStories: newUserStories });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>핵심 유저 스토리</Label>
        <div className="space-y-4 mt-4">
          {prdData.userStories.map((story, index) => (
            <div key={index} className="p-4 border rounded-md relative">
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleRemoveUserStory(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="space-y-2">
                <div>
                  <Label htmlFor={`asA-${index}`} className="text-sm text-muted-foreground">As a...</Label>
                  <Input id={`asA-${index}`} value={story.asA} onChange={e => handleUpdateUserStory(index, 'asA', e.target.value)} placeholder="사용자 역할 (예: 프로덕트 매니저)" />
                </div>
                <div>
                  <Label htmlFor={`iWant-${index}`} className="text-sm text-muted-foreground">I want to...</Label>
                  <Input id={`iWant-${index}`} value={story.iWant} onChange={e => handleUpdateUserStory(index, 'iWant', e.target.value)} placeholder="원하는 것 (예: 정해진 템플릿에 따라 PRD를 빠르게 작성하고 싶다)" />
                </div>
                <div>
                  <Label htmlFor={`soThat-${index}`} className="text-sm text-muted-foreground">So that...</Label>
                  <Input id={`soThat-${index}`} value={story.soThat} onChange={e => handleUpdateUserStory(index, 'soThat', e.target.value)} placeholder="얻는 가치 (예: 핵심 내용에만 집중할 수 있도록)" />
                </div>
              </div>
            </div>
          ))}
          {prdData.userStories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">항목이 없습니다.</p>}
        </div>
        <div className="text-center mt-4">
            <Button variant="outline" size="sm" onClick={handleAddUserStory}>
              <Plus className="mr-2 h-4 w-4" /> 추가
            </Button>
        </div>
      </div>
      
      <div>
        <Label htmlFor="flowSummary">플로우 요약</Label>
        <Textarea id="flowSummary" value={prdData.flowSummary} onChange={e => onDataChange({ flowSummary: e.target.value })} placeholder="사용자가 기능을 사용하는 과정을 설명합니다." />
      </div>

      <RepeatableField
        title="수용 기준 (Acceptance Criteria)"
        items={prdData.acceptanceCriteria}
        updateItems={acceptanceCriteria => onDataChange({ acceptanceCriteria })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => (
          <div className="flex items-center gap-2">
            <Input value={item} onChange={e => onChange(e.target.value)} placeholder="예: 모든 입력 필드는 실시간으로 프리뷰에 반영되어야 한다." />
            <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
    </div>
  );
}
