

import { useState } from 'react';
import type { PrdDocument } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { RepeatableField } from '../repeatable-field';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step1BasicInfo({ prdData, onDataChange }: StepProps) {
  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <Label htmlFor="title">제품명</Label>
            <Input id="title" value={prdData.title} onChange={e => onDataChange({ title: e.target.value })} placeholder="예: AI 기반 PRD 스튜디오" maxLength={20} />
        </div>
         <div>
            <Label htmlFor="project">프로젝트</Label>
            <Input id="project" value={prdData.projectName || '선택 안함'} disabled />
        </div>
      </div>
       <div>
        <Label htmlFor="mission">한 줄 미션</Label>
        <Input id="mission" value={prdData.mission} onChange={e => onDataChange({ mission: e.target.value })} placeholder="예: 프로덕트 매니저가 PRD 작성에 쏟는 시간을 획기적으로 줄여주는 웹 애플리케이션" />
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label htmlFor="background">배경 / 문제정의</Label>

        </div>
        <Textarea id="background" value={prdData.background} onChange={e => onDataChange({ background: e.target.value })} placeholder="이 제품/기능이 왜 필요한가요? 어떤 문제를 해결하나요?" rows={5} />
      </div>
      
      <RepeatableField
        title="목표 (KPI)"
        items={prdData.goals}
        updateItems={goals => onDataChange({ goals })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => (
          <div className="flex items-center gap-2">
            <Input value={item} onChange={e => onChange(e.target.value)} placeholder="예: PRD 작성 시간 50% 단축" />
            <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />

      <div>
        <Label htmlFor="targetUser">타깃 사용자</Label>
        <Input id="targetUser" value={prdData.targetUser} onChange={e => onDataChange({ targetUser: e.target.value })} placeholder="예: 주니어 ~ 시니어 프로덕트 매니저" />
      </div>
      
      <RepeatableField
        title="성공 지표"
        items={prdData.successMetrics}
        updateItems={successMetrics => onDataChange({ successMetrics })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => (
          <div className="flex items-center gap-2">
            <Input value={item} onChange={e => onChange(e.target.value)} placeholder="예: MAU 1,000명 달성" />
            <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      />
    </div>
  );
}
